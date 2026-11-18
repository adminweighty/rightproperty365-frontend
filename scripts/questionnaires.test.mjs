// Checks the questionnaire and application rules the web repeats
// (src/lib/questionnaires.ts): visible_if evaluation, answer checks that
// mirror the API, the submit check, allowed status transitions and the form
// builder's helpers. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptAttribute,
  acceptedTypesText,
  agentStatusActions,
  allowedTransitions,
  answerProblem,
  answerText,
  applicantCanEdit,
  applicantCanWithdraw,
  applicationStatusLabel,
  canRequestInfo,
  canTransition,
  changeFieldType,
  closedKind,
  maxLengthFor,
  definitionProblems,
  fileProblem,
  isFinalStatus,
  keptAnswers,
  keyFromLabel,
  listingTakesApplications,
  listOf,
  makeVisibleIf,
  maxFilesFor,
  moveItem,
  newField,
  normaliseSections,
  numberAnswer,
  submitProblems,
  uniqueKey,
  unwrap,
  visibleIfCandidates,
  visibleIfValues,
  visibleKeys,
} from "../src/lib/questionnaires.ts";

const rental = () => ({
  name: "Rental application",
  market_code: "ZW",
  purpose: "To assess your application to rent this property.",
  privacy_notice: "We keep your answers for 180 days.",
  retention_days: 180,
  sections: [
    {
      key: "about",
      title: "About you",
      fields: [
        { key: "full_name", type: "short_text", label: "Full name", required: true, max_length: 80 },
        { key: "income", type: "number", label: "Monthly income", required: true, min: 0, max: 100000 },
        { key: "move_in", type: "date", label: "Move-in date", required: false, min_date: "2026-12-01" },
      ],
    },
    {
      key: "household",
      title: "Household",
      fields: [
        {
          key: "pets",
          type: "single_choice",
          label: "Do you have pets?",
          required: true,
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
        },
        { key: "pets_describe", type: "long_text", label: "Describe them", required: true, visible_if: { field: "pets", equals: "yes" } },
        {
          key: "pet_kinds",
          type: "multiple_choice",
          label: "Which kinds?",
          required: false,
          max: 2,
          options: [
            { value: "dog", label: "Dog" },
            { value: "cat", label: "Cat" },
            { value: "bird", label: "Bird" },
          ],
          visible_if: { field: "pets", equals: "yes" },
        },
        { key: "dog_licence", type: "file", label: "Dog licence", required: true, accept: ["pdf", "jpg"], max_files: 2, visible_if: { field: "pet_kinds", in: ["dog"] } },
      ],
    },
  ],
});

test("visible_if: a question shows only when its condition is met", () => {
  const form = rental();
  assert.equal(visibleKeys(form, {}).has("pets_describe"), false);
  assert.equal(visibleKeys(form, { pets: "no" }).has("pets_describe"), false);
  assert.equal(visibleKeys(form, { pets: "yes" }).has("pets_describe"), true);
});

test("visible_if: `in` matches any chosen value of a multiple choice", () => {
  const form = rental();
  assert.equal(visibleKeys(form, { pets: "yes", pet_kinds: ["cat"] }).has("dog_licence"), false);
  assert.equal(visibleKeys(form, { pets: "yes", pet_kinds: ["cat", "dog"] }).has("dog_licence"), true);
});

test("visible_if: a chain hides a question whose controlling question is hidden", () => {
  const form = rental();
  // pet_kinds still says dog, but pets is no: pet_kinds is hidden, so dog_licence is too.
  const shown = visibleKeys(form, { pets: "no", pet_kinds: ["dog"] });
  assert.equal(shown.has("pet_kinds"), false);
  assert.equal(shown.has("dog_licence"), false);
});

test("visible_if: a rule naming a later question hides the question", () => {
  const form = rental();
  form.sections[0].fields[0].visible_if = { field: "pets", equals: "yes" };
  assert.equal(visibleKeys(form, { pets: "yes" }).has("full_name"), false);
});

test("keptAnswers drops answers of hidden questions", () => {
  const form = rental();
  assert.deepEqual(keptAnswers(form, { full_name: "Rudo", pets: "no", pets_describe: "A cat" }), { full_name: "Rudo", pets: "no" });
});

test("answerProblem mirrors the API's per-question rules", () => {
  const [name, income, moveIn] = rental().sections[0].fields;
  const [pets, , kinds, licence] = rental().sections[1].fields;
  assert.equal(answerProblem(name, ""), null, "an empty answer is not checked here");
  assert.equal(answerProblem(name, "x".repeat(81)), "Write at most 80 characters.");
  assert.equal(answerProblem(income, "abc"), "Enter a number, using digits.");
  assert.equal(answerProblem(income, -1), "Enter 0 or more.");
  assert.equal(answerProblem(income, 100001), "Enter 100000 or less.");
  assert.equal(answerProblem(income, 2500), null);
  assert.equal(answerProblem(moveIn, "2026-02-30"), "Enter a real date.");
  assert.equal(answerProblem(moveIn, "2026-11-30"), "Choose 1 December 2026 or later.");
  assert.equal(answerProblem(moveIn, "2026-12-01"), null);
  assert.equal(answerProblem(pets, "maybe"), "Choose one of the answers.");
  assert.equal(answerProblem(kinds, ["dog", "cat", "bird"]), "Choose at most 2.");
  assert.equal(answerProblem(kinds, ["fish"]), "Choose from the answers given.");
  assert.equal(answerProblem(licence, ["a", "b", "c"]), "Attach at most 2 files.");
});

test("submitProblems: required only when shown, in form order", () => {
  const form = rental();
  assert.deepEqual(Object.keys(submitProblems(form, {})), ["full_name", "income", "pets"]);
  const withPets = submitProblems(form, { full_name: "Rudo", income: 900, pets: "yes", pet_kinds: ["dog"] });
  assert.deepEqual(Object.keys(withPets), ["pets_describe", "dog_licence"]);
  assert.equal(withPets.pets_describe, "Answer “Describe them”.");
  assert.deepEqual(submitProblems(form, { full_name: "Rudo", income: 900, pets: "no", pets_describe: "" }), {});
});

test("allowed transitions follow the contract", () => {
  assert.deepEqual(allowedTransitions("SUBMITTED"), ["UNDER_REVIEW", "MORE_INFO", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);
  assert.deepEqual(allowedTransitions("UNDER_REVIEW"), ["MORE_INFO", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN"]);
  assert.deepEqual(allowedTransitions("SHORTLISTED"), ["ACCEPTED", "REJECTED", "WITHDRAWN"]);
  for (const final of ["ACCEPTED", "REJECTED", "WITHDRAWN"]) {
    assert.deepEqual(allowedTransitions(final), []);
    assert.equal(isFinalStatus(final), true);
  }
  assert.equal(canTransition("SHORTLISTED", "UNDER_REVIEW"), false);
  assert.equal(canTransition("MORE_INFO", "SUBMITTED"), true);
  assert.deepEqual(allowedTransitions("NOPE"), []);
});

test("agent actions: status endpoint targets only, the API's list wins", () => {
  assert.deepEqual(agentStatusActions("SUBMITTED"), ["UNDER_REVIEW", "SHORTLISTED", "ACCEPTED", "REJECTED"]);
  assert.deepEqual(agentStatusActions("SHORTLISTED"), ["ACCEPTED", "REJECTED"]);
  assert.deepEqual(agentStatusActions("MORE_INFO"), []);
  assert.deepEqual(agentStatusActions("SUBMITTED", ["REJECTED", "WITHDRAWN"]), ["REJECTED"]);
  assert.equal(canRequestInfo("UNDER_REVIEW"), true);
  assert.equal(canRequestInfo("SHORTLISTED"), false);
});

test("applicant: edits in draft and more-info, withdraws until final", () => {
  assert.equal(applicantCanEdit("DRAFT"), true);
  assert.equal(applicantCanEdit("MORE_INFO"), true);
  assert.equal(applicantCanEdit("SUBMITTED"), false);
  assert.equal(applicantCanWithdraw("SHORTLISTED"), true);
  assert.equal(applicantCanWithdraw("ACCEPTED"), false);
  assert.equal(applicationStatusLabel("MORE_INFO"), "More information needed");
  assert.equal(applicationStatusLabel("MORE_INFO", "Info requested"), "Info requested");
  assert.equal(applicationStatusLabel("ON_HOLD"), "On hold");
});

test("definitionProblems: a good form has none", () => {
  assert.deepEqual(definitionProblems(rental()), []);
});

test("definitionProblems: the API's rules", () => {
  const form = rental();
  form.purpose = " ";
  form.retention_days = 10;
  form.sections[1].fields[0].options = [{ value: "yes", label: "Yes" }];
  form.sections[1].fields.push({ key: "full_name", type: "short_text", label: "Again", required: false });
  form.sections[1].fields[3].accept = ["exe"];
  form.sections[0].fields[0].visible_if = { field: "pets", equals: "yes" };
  const messages = definitionProblems(form).map((problem) => problem.path);
  assert.ok(messages.includes("form.purpose"));
  assert.ok(messages.includes("form.retention_days"));
  assert.ok(messages.includes("field.pets.options"));
  assert.ok(messages.includes("field.full_name.key"));
  assert.ok(messages.includes("field.dog_licence.accept"));
  assert.ok(messages.includes("field.full_name.visible_if"));
});

test("definitionProblems: visible_if only on an earlier choice question, with values it offers", () => {
  const onText = rental();
  onText.sections[1].fields[1].visible_if = { field: "full_name", equals: "Rudo" };
  assert.deepEqual(definitionProblems(onText).map((problem) => problem.path), ["field.pets_describe.visible_if"]);
  const gone = rental();
  gone.sections[1].fields[1].visible_if = { field: "pets", equals: "maybe" };
  assert.match(definitionProblems(gone)[0].message, /no longer offers/);
  const tooMany = rental();
  tooMany.sections[1].fields[2].max = 4;
  assert.deepEqual(definitionProblems(tooMany).map((problem) => problem.path), ["field.pet_kinds.max"]);
  const long = rental();
  long.sections[0].fields[0].max_length = 501;
  assert.deepEqual(definitionProblems(long).map((problem) => problem.path), ["field.full_name.max_length"]);
});

test("text limits follow the API: short 200 (cap 500), long 5000 (cap 10000)", () => {
  assert.equal(maxLengthFor({ type: "short_text" }), 200);
  assert.equal(maxLengthFor({ type: "short_text", max_length: 900 }), 500);
  assert.equal(maxLengthFor({ type: "long_text" }), 5000);
  assert.equal(maxLengthFor({ type: "long_text", max_length: 300 }), 300);
  assert.equal(answerProblem({ key: "x", type: "short_text", label: "X", required: false }, "x".repeat(201)), "Write at most 200 characters.");
});

test("keys: from labels, unique, valid", () => {
  assert.equal(keyFromLabel("Do you have pets?"), "do_you_have_pets");
  assert.equal(keyFromLabel("Événement"), "evenement");
  assert.equal(keyFromLabel("2 bedrooms"), "q_2_bedrooms");
  assert.equal(keyFromLabel("???"), "question");
  assert.equal(uniqueKey("pets", ["pets", "pets_2"]), "pets_3");
  assert.equal(newField("single_choice", ["one_choice"]).key, "one_choice_2");
  assert.equal(newField("single_choice", []).options.length, 2);
  assert.equal(newField("file", []).max_files, 1);
});

test("moveItem and changeFieldType", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 5), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  const changed = changeFieldType({ key: "k", type: "short_text", label: "L", required: true }, "multiple_choice");
  assert.equal(changed.key, "k");
  assert.equal(changed.required, true);
  assert.equal(changed.options.length, 2);
});

test("visible_if picker: earlier choice questions only; one value is equals, several are in", () => {
  const form = rental();
  assert.deepEqual(visibleIfCandidates(form, "dog_licence").map((field) => field.key), ["pets", "pet_kinds"]);
  assert.deepEqual(visibleIfCandidates(form, "pets").map((field) => field.key), []);
  assert.deepEqual(makeVisibleIf("pets", ["yes"]), { field: "pets", equals: "yes" });
  assert.deepEqual(makeVisibleIf("pets", ["yes", "no"]), { field: "pets", in: ["yes", "no"] });
  assert.equal(makeVisibleIf("pets", []), null);
  assert.deepEqual(visibleIfValues({ field: "x", equals: true }), ["true"]);
});

test("files: allowlist, size, words", () => {
  const field = { accept: ["pdf", "jpg"] };
  assert.equal(acceptedTypesText(field), "PDF or JPEG");
  assert.ok(acceptAttribute(field).includes(".jpeg"));
  assert.equal(fileProblem({ name: "a.pdf", type: "application/pdf", size: 100 }, field), null);
  assert.equal(fileProblem({ name: "a.JPG", type: "", size: 100 }, field), null);
  assert.match(fileProblem({ name: "a.png", type: "image/png", size: 100 }, field), /not a PDF or JPEG file/);
  assert.match(fileProblem({ name: "a.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }, field), /10 MB or less/);
  assert.equal(maxFilesFor({ max_files: 9 }), 5);
  assert.equal(maxFilesFor({}), 1);
});

test("answers as words and numbers as sent", () => {
  const [pets, , kinds] = rental().sections[1].fields;
  assert.equal(answerText(pets, "yes"), "Yes");
  assert.equal(answerText(kinds, ["dog", "cat"]), "Dog, Cat");
  assert.equal(numberAnswer(" 1,200 "), 1200);
  assert.equal(numberAnswer(""), null);
  assert.equal(numberAnswer("12a"), "12a");
});

test("reading the API: wrapped or bare, lists as items", () => {
  assert.deepEqual(unwrap({ form: { id: "f" } }, "form"), { id: "f" });
  assert.deepEqual(unwrap({ id: "f" }, "form"), { id: "f" });
  assert.equal(unwrap(null, "form"), null);
  assert.deepEqual(listOf({ items: [1] }), [1]);
  assert.deepEqual(listOf({ forms: [2] }, "forms"), [2]);
  assert.deepEqual(listOf([3]), [3]);
  assert.deepEqual(listOf({}), []);
  const [section] = normaliseSections([{ title: "A", fields: [{ key: "x", type: "weird", label: "X" }] }]);
  assert.equal(section.key, "section_1");
  assert.equal(section.fields[0].type, "short_text");
  assert.equal(section.fields[0].required, false);
});

test("intake words", () => {
  assert.equal(closedKind("Applications for this listing are paused."), "paused");
  assert.equal(closedKind("The form has expired"), "expired");
  assert.equal(closedKind(undefined), "closed");
  assert.equal(closedKind("", "PAUSED"), "paused");
  assert.equal(closedKind("", "FORM_EXPIRED"), "expired");
  assert.equal(closedKind("paused", "CLOSES_AT_PASSED"), "closed");
  assert.equal(listingTakesApplications("short-stay"), false);
  assert.equal(listingTakesApplications("residential"), true);
});
