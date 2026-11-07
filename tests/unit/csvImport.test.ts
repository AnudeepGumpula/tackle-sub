import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPreview, parseAmount, parseCsv, parseDate, SAMPLE_FRESHBOOKS_CSV } from "../../src/lib/csvImport.ts";

test("parseCsv handles quotes, commas, newlines, CRLF, BOM", () => {
  const rows = parseCsv('﻿a,b,c\r\n"x, y","say ""hi""","multi\nline"\r\n\r\n1,2,3');
  assert.deepEqual(rows, [["a", "b", "c"], ["x, y", 'say "hi"', "multi\nline"], ["1", "2", "3"]]);
});

test("parseCsv detects semicolon delimiters", () => {
  assert.deepEqual(parseCsv("Client;Total\nAcme;1.200,50"), [["Client", "Total"], ["Acme", "1.200,50"]]);
});

test("parseDate formats", () => {
  assert.equal(parseDate("2026-11-07"), "2026-11-07");
  assert.equal(parseDate("11/07/2026"), "2026-11-07");
  assert.equal(parseDate("07.11.2026"), "2026-11-07");
  assert.equal(parseDate("Nov 7, 2026"), "2026-11-07");
  assert.equal(parseDate("7 November 2026"), "2026-11-07");
  assert.equal(parseDate("2026-02-30"), null);
  assert.equal(parseDate("soon"), null);
});

test("parseAmount formats", () => {
  assert.equal(parseAmount("$1,200.50"), 1200.5);
  assert.equal(parseAmount("1.200,50 €"), 1200.5);
  assert.equal(parseAmount("USD 300"), 300);
  assert.equal(parseAmount("(45.00)"), null);
  assert.equal(parseAmount(""), null);
});

test("FreshBooks-style sample maps statuses, balances and skips voids", () => {
  const p = buildPreview(SAMPLE_FRESHBOOKS_CSV);
  assert.equal(p.kind, "invoices");
  assert.equal(p.columns.client, "Client Name");
  assert.equal(p.columns.balance, "Outstanding");
  assert.equal(p.columns.due, "Due Date");
  assert.equal(p.rows.length, 4);
  const [paid, sent, overdue, partial] = p.rows;
  assert.deepEqual([paid.status, paid.amount, paid.number], ["paid", 1250, "0042"]);
  assert.deepEqual([sent.status, sent.amount, sent.client_email], ["open", 3400, "ap@lumenlabs.example"]);
  assert.equal(overdue.status, "open");
  assert.deepEqual([partial.status, partial.amount], ["open", 900]); // only the unpaid balance comes over
  assert.deepEqual(p.skipped, [{ line: 6, reason: "Voided or cancelled" }]);
  assert.equal(p.clients.length, 4);
});

test("QuickBooks-style headers", () => {
  const p = buildPreview("Num,Customer,Date,Due date,Amount,Open balance\n1001,Acme Inc,11/01/2026,12/01/2026,$500.00,$500.00\n1002,Acme Inc,10/01/2026,10/31/2026,$200.00,$0.00\nTOTAL,,,,$700.00,$500.00");
  assert.equal(p.rows.length, 2);
  assert.deepEqual([p.rows[0].status, p.rows[0].issue_date, p.rows[0].due_date], ["open", "2026-11-01", "2026-12-01"]);
  assert.equal(p.rows[1].status, "paid"); // zero balance, no status column
});

test("client-only export", () => {
  const p = buildPreview("First Name,Last Name,Email,Organization\nAda,Lovelace,ada@example.com,\nAlan,Turing,alan@example.com,");
  assert.equal(p.kind, "clients");
  assert.deepEqual(p.clients, [{ name: "Ada Lovelace", email: "ada@example.com" }, { name: "Alan Turing", email: "alan@example.com" }]);
});

test("helpful error when there is no client column", () => {
  assert.throws(() => buildPreview("Foo,Bar\n1,2"), /client\/customer column/);
});
