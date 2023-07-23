import { Command } from "@commander-js/extra-typings"
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { Octokit } from "@octokit/core"
import Conf from "conf"
import { select, checkbox, confirm } from "@inquirer/prompts"
import chalk from "chalk"

const program = new Command()
const config = new Conf({
  projectName: "gh-clean",
})

program
  .name("gh-clean")
  .description("CLI to cleanup repositories on github")
  .version("0.0.1")

program
  .command("login")
  .description("Login to github")
  .option("-f, --force", "Force login")
  .action(async ({ force }) => {
    if (!force && config.has("token")) {
      console.log("Already logged in")
      return
    }

    const auth = createOAuthDeviceAuth({
      clientType: "github-app",
      clientId: "Iv1.856e96ee86eb492f",
      onVerification(verification) {
        console.log("Open %s", verification.verification_uri)
        console.log("Enter code: %s", verification.user_code)
      },
    })

    const authResponse = await auth({
      type: "oauth",
    })
    config.set("token", authResponse.token)
  })

program
  .command("repo")
  .description("Cleans github repos")
  .action(async () => {
    if (!config.has("token")) {
      console.log("Please login first")
      return
    }

    const octokit = new Octokit({
      auth: config.get("token"),
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

    const repos = await octokit
      .request("GET /user/repos", {
        visibility,
        affiliation: affiliation.length > 0 ? affiliation.join(",") : undefined,
      })
      .then((res) => res.data)

    const selectedRepos = await checkbox({
      message: "Select repos",
      choices: repos.map((repo) => ({
        name: repo.full_name,
        value: repo,
      })),
    })

    const action = await select({
      message: "Select an action",
      choices: [
        {
          name: "Private",
          value: "private",
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
          : "deleted:",
      ),
    )
    for (const repo of selectedRepos) {
      console.log(chalk.blue(repo.full_name) + "\n")
    }

    const shouldGoAhead = await confirm({
      message: "Are you sure?",
      default: false,
    })
    if (!shouldGoAhead) {
      return
    }

    console.log(chalk.blue("Processing..."))
  })

program.parse()
