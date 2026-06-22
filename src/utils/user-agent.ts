import { ParsedUserAgent } from "../types";

const MOBILE_REGEX =
  /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i;
const TABLET_REGEX = /iPad|Android(?!.*Mobile)|Tablet|Silk/i;

const BROWSER_PATTERNS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\/([\d.]+)/, "Edge"],
  [/OPR\/([\d.]+)/, "Opera"],
  [/Chrome\/([\d.]+)/, "Chrome"],
  [/Firefox\/([\d.]+)/, "Firefox"],
  [/Safari\/([\d.]+)/, "Safari"],
  [/MSIE\s([\d.]+)/, "IE"],
  [/Trident\/.*rv:([\d.]+)/, "IE"],
];

const OS_PATTERNS: [RegExp, string, string][] = [
  [/Windows NT 10\.0/, "Windows", "10"],
  [/Windows NT 6\.3/, "Windows", "8.1"],
  [/Windows NT 6\.2/, "Windows", "8"],
  [/Windows NT 6\.1/, "Windows", "7"],
  [/Windows/, "Windows", "Unknown"],
  [/Mac OS X ([\d_]+)/, "macOS", ""],
  [/CrOS x86_64 ([\d_]+)/, "ChromeOS", ""],
  [/Android ([\d.]+)/, "Android", ""],
  [/iPhone OS ([\d_]+)/, "iOS", ""],
  [/iPad.*OS ([\d_]+)/, "iOS", ""],
  [/Linux(?!\s.*Android)/, "Linux", ""],
];

export function parseUserAgent(ua: string | undefined): ParsedUserAgent {
  if (!ua) {
    return {
      browser: "Unknown",
      browserVersion: "",
      os: "Unknown",
      osVersion: "",
      deviceType: "unknown",
    };
  }

  let browser = "Unknown";
  let browserVersion = "";

  for (const [regex, name] of BROWSER_PATTERNS) {
    const match = ua.match(regex);
    if (match) {
      browser = name;
      browserVersion = (match[1] || "").replace(/_/g, ".");
      break;
    }
  }

  let os = "Unknown";
  let osVersion = "";

  for (const [regex, osName, fallbackVersion] of OS_PATTERNS) {
    const match = ua.match(regex);
    if (match) {
      os = osName;
      if (match[1]) {
        osVersion = match[1].replace(/_/g, ".");
      } else {
        osVersion = fallbackVersion;
      }
      break;
    }
  }

  let deviceType: ParsedUserAgent["deviceType"] = "desktop";
  if (TABLET_REGEX.test(ua)) {
    deviceType = "tablet";
  } else if (MOBILE_REGEX.test(ua)) {
    deviceType = "mobile";
  }

  return { browser, browserVersion, os, osVersion, deviceType };
}
