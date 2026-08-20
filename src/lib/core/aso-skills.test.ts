import assert from "node:assert/strict";
import test from "node:test";
import { getAsoSkill, listAsoSkills, searchAsoSkills } from "./aso-skills";

test("indexes the complete vendored ASO skill library", async () => {
  const skills = await listAsoSkills();
  assert.equal(skills.length, 40);
  assert.ok(skills.some((skill) => skill.name === "aso-router"));
  assert.ok(skills.some((skill) => skill.name === "keyword-research"));
  assert.ok(skills.every((skill) => skill.description.length > 0));
});

test("routes English and Turkish keyword requests to keyword research", async () => {
  assert.equal((await searchAsoSkills("find keyword opportunities", 1))[0]?.name, "keyword-research");
  assert.equal((await searchAsoSkills("uygulamam için anahtar kelimeler bul", 1))[0]?.name, "keyword-research");
});

test("wraps upstream skills in local-first cross-MCP safety rules", async () => {
  const result = await getAsoSkill("keyword-research");
  assert.match(result.instructions, /Use Sosis MCP for the user's current App Store Connect metadata/);
  assert.match(result.instructions, /Never invent live volume/);
  assert.match(result.instructions, /# Keyword Research/);
  assert.equal(result.source.license, "MIT");
  assert.equal(result.orchestration.firstPartyData, "Sosis MCP");
});

test("rejects traversal and unknown skill names", async () => {
  await assert.rejects(getAsoSkill("../keyword-research"), /ASO_SKILL_NAME_INVALID/);
  await assert.rejects(getAsoSkill("not-a-real-skill"), /ASO_SKILL_NOT_FOUND/);
});
