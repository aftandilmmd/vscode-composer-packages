import * as https from "https";

export interface PackagistPackage {
  name: string;
  description: string;
  url: string;
  repository: string;
  downloads: number;
  favers: number;
  abandoned?: boolean | string;
}

export interface SearchResult {
  results: PackagistPackage[];
  total: number;
  next?: string;
}

export interface PackageInfo {
  name: string;
  description: string;
  latestVersion: string;
  downloads: number;
  favers: number;
  repository: string;
  url: string;
}

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "VSCode-Packagist-Explorer/0.0.1" } }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

export async function searchPackages(query: string, page = 1): Promise<SearchResult> {
  const url = `https://packagist.org/search.json?q=${encodeURIComponent(query)}&page=${page}&per_page=20`;
  const body = await get(url);
  return JSON.parse(body) as SearchResult;
}

export async function getPackageReadme(repositoryUrl: string): Promise<string | null> {
  // Extract owner/repo from GitHub URL
  const match = repositoryUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) { return null; }
  const repo = match[1];
  const apiUrl = `https://api.github.com/repos/${repo}/readme`;
  try {
    const body = await get(apiUrl);
    const data = JSON.parse(body) as { content?: string; encoding?: string };
    if (data.content && data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
    }
  } catch {
    // ignore
  }
  return null;
}

export interface PopularResult {
  packages: PackagistPackage[];
  next?: string;
}

export async function getPopularPackages(nextUrl?: string): Promise<PopularResult> {
  const url = nextUrl ?? `https://packagist.org/explore/popular.json?per_page=20`;
  const body = await get(url);
  const data = JSON.parse(body) as { packages: PackagistPackage[]; next?: string };
  return { packages: data.packages, next: data.next };
}


export async function getPackageInfo(name: string): Promise<PackageInfo> {
  const url = `https://packagist.org/packages/${name}.json`;
  const body = await get(url);
  const data = JSON.parse(body) as {
    package: {
      name: string;
      description: string;
      repository: string;
      downloads: { total: number };
      favers: number;
      versions: Record<string, { version: string }>;
    };
  };
  const pkg = data.package;

  const stableVersions = Object.keys(pkg.versions).filter(
    (v) => !v.includes("dev") && !v.startsWith("dev-")
  );
  const latestVersion = stableVersions[0] ?? Object.keys(pkg.versions)[0] ?? "unknown";

  return {
    name: pkg.name,
    description: pkg.description,
    latestVersion,
    downloads: pkg.downloads.total,
    favers: pkg.favers,
    repository: pkg.repository,
    url: `https://packagist.org/packages/${pkg.name}`,
  };
}
