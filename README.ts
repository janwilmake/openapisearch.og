/// <reference types="@cloudflare/workers-types" />
/**
 * Cloudflare worker that puts out an og-image; written in as few tokens as possible.
 *
 * Ideal for alteration with LLMs into an og-image with a different purpose.
 *
 * Common problems with workers-og:
 * - none, just use simple css, like below!
 */
import { ImageResponse } from "workers-og";
const og = `<div
    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background-color: #f0f0f0; margin: 0; display: flex;">
    <div class="card"
        style="background-color: white; box-shadow: 0 8px 12px rgba(0, 0, 0, 0.1); overflow: hidden; width: 1200px; height: 630px; display: flex; flex-direction: column;">
        <div class="content" style="flex-grow: 1; display: flex; align-items: center;">
            <div class="header" style="padding: 40px; display: flex; align-items: center; flex-grow: 1;">
                <div class="title-container" style="flex-grow: 1; display: flex; flex-direction: column;">
                    <div class="title" id="title"
                        style="font-size: 56px; font-weight: bold; margin-bottom: 20px; display: flex;">tzador/makedown
                    </div>
                    <div class="subtitle" id="description" style="display: flex; font-size: 32px; color: #666;">Organise
                        your shell scripts within executable markdown files</div>
                </div>
                <img id="avatar" width="160" height="160" src="/api/placeholder/160/160" alt="Avatar"
                    style="width: 160px; height: 160px; border-radius: 20px; margin-left: 40px;">
            </div>
        </div>
        <div class="stats"
            style="display: flex; justify-content: space-around; padding: 30px 0 60px 0; background-color: #75147c; border-top: 2px solid #eee;">
            <div class="stat" style="text-align: center; display: flex; flex-direction: column;">
                <div id="tokens" class="stat-value"
                    style="color:#fff; display: flex; font-weight: bold; font-size: 36px; justify-content: center;">100
                </div>
                <div class="stat-label" style="display: flex; font-size: 24px; color: #fff; justify-content: center;">
                    LLM Tokens</div>
            </div>
            <div class="stat" style="text-align: center; display: flex; flex-direction: column;">
                <div class="stat-value" id="issues"
                    style="color:#fff; display: flex; font-weight: bold; font-size: 36px; justify-content: center;">16
                </div>
                <div class="stat-label" style="display: flex; font-size: 24px; color: #fff; justify-content: center;">
                    Issues</div>
            </div>
            <div class="stat" style="text-align: center; display: flex; flex-direction: column;">
                <div class="stat-value" id="stars"
                    style="color:#fff; display: flex; font-weight: bold; font-size: 36px; justify-content: center;">141
                </div>
                <div class="stat-label" style="display: flex; font-size: 24px; color: #fff; justify-content: center;">
                    Stars</div>
            </div>
            <div class="stat" style="text-align: center; display: flex; flex-direction: column;">
                <div class="stat-value" id="forks"
                    style="color:#fff; display: flex; font-weight: bold; font-size: 36px; justify-content: center;">2
                </div>
                <div class="stat-label" style="display: flex; font-size: 24px; color: #fff; justify-content: center;">
                    Forks</div>
            </div>
            <svg class="github-icon" viewBox="0 0 16 16" version="1.1" width="64" height="64" aria-hidden="true">
                <path fill="white" fill-rule="evenodd"
                    d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z">
                </path>
            </svg>
        </div>
    </div>
</div>`;
interface RepoDetails {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  archived: boolean;
  default_branch: string;
  pushed_at: string | null;
  created_at: string;
  homepage: string | null;
  topics: string[] | null;
  updated_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
}

async function fetchRepoDetails(
  token: string | undefined,
  owner: string,
  repo: string,
): Promise<{
  status: number;
  statusText?: string;
  message?: string;
  result?: RepoDetails;
}> {
  const headers: { [key: string]: string } = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "github-og-image",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    return {
      status: response.status,
      statusText: response.statusText,
      message: await response.text(),
    };
  }

  const data: RepoDetails = await response.json();

  return { result: data, status: response.status };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const response = new Response(og, {
      headers: { "Content-Type": "text/html" },
    });
    const url = new URL(request.url);
    const [_, owner, repo] = url.pathname.split("/");
    const path = url.searchParams.get("path");
    const tokens = url.searchParams.get("tokens");

    if (!owner || !repo) {
      return new Response("Not found", { status: 404 });
    }

    const details = await fetchRepoDetails(undefined, owner, repo);
    if (!details.result) {
      console.log({ details });
      return new Response("Repo not found", { status: 404 });
    }

    const pathPart = path ? `/${path}` : "";
    const repoData = {
      title: `${owner}/${repo}${pathPart}`,
      description: details.result.description || "",
      avatarUrl: details.result.owner.avatar_url,
      tokens,
      issues: details.result.open_issues_count,
      stars: details.result.stargazers_count,
      forks: details.result.forks_count,
    };

    const rewrite = new HTMLRewriter()
      .on("#title, #description, #tokens, #issues, #stars, #forks", {
        element(el) {
          el.setInnerContent(repoData[el.getAttribute("id")!]);
        },
      })
      .on("#avatar", {
        element(el) {
          el.setAttribute("src", repoData.avatarUrl);
        },
      })
      .transform(response);

    const text = await rewrite.text();

    return new ImageResponse(text, {
      // 2x bigger than needed to prevent it being bad quality
      width: 1200,
      height: 630,
      format: "png",
    });
  },
};
