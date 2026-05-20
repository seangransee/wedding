import { neon } from "@neondatabase/serverless";
import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

async function loadEnvFiles() {
  for (const fileName of [".env.local", ".env"]) {
    const filePath = path.join(root, fileName);
    if (!existsSync(filePath)) {
      continue;
    }

    const content = await readFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const equalsIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] ??= value;
    }
  }
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let dollarQuoteTag = null;

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index];
    const next = sqlText[index + 1];

    if (!singleQuoted && !doubleQuoted && !dollarQuoteTag && char === "-" && next === "-") {
      const newlineIndex = sqlText.indexOf("\n", index);
      if (newlineIndex === -1) {
        break;
      }
      current += sqlText.slice(index, newlineIndex + 1);
      index = newlineIndex;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && !dollarQuoteTag && char === "/" && next === "*") {
      const closeIndex = sqlText.indexOf("*/", index + 2);
      if (closeIndex === -1) {
        current += sqlText.slice(index);
        break;
      }
      current += sqlText.slice(index, closeIndex + 2);
      index = closeIndex + 1;
      continue;
    }

    if (!singleQuoted && !doubleQuoted && char === "$") {
      const match = sqlText.slice(index).match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        const tag = match[0];
        if (dollarQuoteTag === tag) {
          dollarQuoteTag = null;
        } else if (!dollarQuoteTag) {
          dollarQuoteTag = tag;
        }
        current += tag;
        index += tag.length - 1;
        continue;
      }
    }

    if (!dollarQuoteTag && !doubleQuoted && char === "'" && sqlText[index - 1] !== "\\") {
      singleQuoted = !singleQuoted;
    } else if (!dollarQuoteTag && !singleQuoted && char === '"') {
      doubleQuoted = !doubleQuoted;
    }

    if (!singleQuoted && !doubleQuoted && !dollarQuoteTag && char === ";") {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const statement = current.trim();
  if (statement) {
    statements.push(statement);
  }

  return statements;
}

await loadEnvFiles();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Add it to .env.local or pass it in the environment.");
}

function shouldUseLocalPostgres(connectionString) {
  const { hostname } = new URL(connectionString);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function createSqlClient(connectionString) {
  if (shouldUseLocalPostgres(connectionString)) {
    const pool = new pg.Pool({ connectionString });
    return {
      query: async (queryText, values) => {
        await pool.query(queryText, values);
      },
      end: () => pool.end(),
    };
  }

  const neonClient = neon(connectionString);
  return {
    query: (queryText, values) => neonClient.query(queryText, values),
    end: async () => {},
  };
}

const sql = createSqlClient(process.env.DATABASE_URL);
const migrationsDir = path.join(root, "migrations");
const migrationFiles = (await readdir(migrationsDir))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort();

let statementCount = 0;

try {
  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(migrationsDir, migrationFile);
    const migrationSql = await readFile(migrationPath, "utf8");
    const statements = splitSqlStatements(migrationSql);

    for (const statement of statements) {
      await sql.query(statement);
      statementCount += 1;
    }
  }
} finally {
  await sql.end();
}

console.log(`Applied ${statementCount} migration statements from ${migrationFiles.length} file(s).`);
