#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings"
import { checkbox, confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import Conf from "conf"
import { getGithubToken } from "./github.js"

import packageJson from "../package.json"
import { Octokit } from "octokit"

type ConfigProps = {
  token: string
  expiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
}

export type Config = Conf<ConfigProps>

const program = new Command()
const config = new Conf<ConfigProps>({
  projectName: "gh-clean",
})

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version)

program
  .command("login")
  .description("Login to github")
  .option("-f, --force", "Force login")
  .action(async ({ force }) => {
    await getGithubToken(config, force)
  })

program
  .command("repo")
  .description("Cleans github repos")
  .option("-f, --force", "Force login")
  .action(async ({ force }) => {
    const token = await getGithubToken(config, force)
    const octokit = new Octokit({
      auth: token,
    })

    const visibility = await select({
      message: "Select visibility of repos to fetch",
      choices: [
        {
          name: "All",
          value: "all",
        },
        {
          name: "Public",
          value: "public",
        },
        {
          name: "Private",
          value: "private",
        },
      ] as const,
    })

    const affiliation = await checkbox({
      message: "Select affiliation of repos to fetch",
      choices: [
        {
          name: "Owner",
          value: "owner",
        },
        {
          name: "Collaborator",
          value: "collaborator",
        },
        {
          name: "Organization member",
          value: "organization_member",
        },
      ] as const,
    })

    console.log(chalk.blue("Fetching repos..."))

    const repos = await octokit.paginate("GET /user/repos", {
      visibility,
      affiliation: affiliation.length > 0 ? affiliation.join(",") : undefined,
      sort: "created",
    })

    const selectedRepos = await checkbox({
      message: "Select repos",
      choices: repos.map((repo) => ({
        name: repo.full_name + (repo.fork ? " (forked)" : ""),
        value: repo,
      })),
    })

    if (selectedRepos.length === 0) {
      console.log(chalk.yellow("⚠︎ No repos selected"))
      return
    }

    const action = await select({
      message: "Select an action",
      choices: [
        {
          name: "Private",
          value: "private",
        },
        {
          name: "Public",
          value: "public",
        },
        {
          name: "Archive",
          value: "archive",
        },
        {
          name: "Delete",
          value: "delete",
        },
      ] as const,
    })

    // List repos
    console.log(
      chalk.blue(
        "The following repos will be",
        action === "private"
          ? "made private:"
          : action === "archive"
          ? "archived:"
          : action === "public"
          ? "made public"
          : "deleted:",
      ),
    )

    for (const repo of selectedRepos) {
      console.log(chalk.blue(" • " + repo.full_name) + "\n")
    }

    const shouldGoAhead = await confirm({
      message: "Are you sure?",
      default: false,
    })
    if (!shouldGoAhead) {
      return
    }

    console.log(chalk.blue("Processing..."))

    for (const repo of selectedRepos) {
      if (action === "private") {
        await octokit.request("PATCH /repos/{owner}/{repo}", {
          owner: repo.owner.login,
          repo: repo.name,
          private: true,
        })
      } else if (action === "archive") {
        await octokit.request("PATCH /repos/{owner}/{repo}", {
          owner: repo.owner.login,
          repo: repo.name,
          archived: true,
        })
      } else if (action === "delete") {
        await octokit.request("DELETE /repos/{owner}/{repo}", {
          owner: repo.owner.login,
          repo: repo.name,
        })
      } else if (action === "public") {
        await octokit.request("PATCH /repos/{owner}/{repo}", {
          owner: repo.owner.login,
          repo: repo.name,
          private: false,
        })
      }
    }
  })

program.parse()
