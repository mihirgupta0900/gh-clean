import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device"
import { Config } from "./index.js"

export const getGithubToken = async (config: Config, forceLogin = false) => {
  let token = config.get("token")

  if (!token || forceLogin) {
    const auth = createOAuthDeviceAuth({
      clientType: "oauth-app",
      clientId: "253bf1663b6e79590714",
      scopes: ["repo", "delete_repo"],
      onVerification: (verification) => {
        console.log("Open %s", verification.verification_uri)
        console.log("Enter code: %s", verification.user_code)
      },
    })

    /**
     * If "User-to-server token expiration" is enabled for the GitHub App,
     * the token will expire after 8 hour.
     */
    const authResponse = await auth({
      type: "oauth",
    })

    token = authResponse.token
    config.set("token", authResponse.token)
  }

  return token
}
