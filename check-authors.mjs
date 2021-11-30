#!/usr/bin/env node

import { execSync } from "child_process";

const [filePath] = process.argv.slice(2);

if (!filePath) {
  throw new Error("Missing file path argument");
}

console.log('GITHUB_REF_NAME', process.env.GITHUB_REF_NAME)
console.log('GITHUB_HEAD_REF', process.env.GITHUB_HEAD_REF)
console.log('GITHUB_BASE_REF', process.env.GITHUB_BASE_REF)
const authorizedUsers = ["nicola.molinari@commercetools.com"];

const outputMergeBase = execSync("git merge-base remotes/origin/master remotes/origin/nm-git-log", {
  encoding: "utf8",
});

const output = execSync(
  `git --no-pager log ${outputMergeBase.trim()}..HEAD --pretty=format:"%ae" -- ${filePath}`,
  {
    encoding: "utf8",
  }
);

const authors = output.trim().split("\n");

const unauthorizedAuthors = authors
  .filter((author) => !authorizedUsers.includes(author))
  .filter(onlyUnique);

if (unauthorizedAuthors.length > 0) {
  throw new Error(
    `Changes to the file ${filePath} are only allowed for the users ${authorizedUsers.toString()}. Instead the following users attempted to change something: ${unauthorizedAuthors.toString()}.`
  );
} else {
  console.log(`All good!`);
  process.exit(0);
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}
