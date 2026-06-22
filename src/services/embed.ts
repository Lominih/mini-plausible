interface EmbedOptions {
  siteId: string;
  endpoint?: string;
  domain?: string;
  customEvents?: boolean;
  hashMode?: boolean;
}

export function generateEmbedScript(options: EmbedOptions): string {
  const {
    siteId,
    endpoint = "/api/event",
    domain = "",
    customEvents = false,
    hashMode = false,
  } = options;

  const scriptContent = `(function(){var e="${siteId}";var n="${endpoint}";var s="${hashMode}";var a="${customEvents}";var i=window.location.href;var l=document.referrer||"";function g(){var t=new XMLHttpRequest();t.open("POST",n,true);t.setRequestHeader("Content-Type","application/json");t.send(JSON.stringify({site_id:e,url:i,referrer:l,browser:navigator.userAgent,screen_width:window.innerWidth,device_type:window.innerWidth>1024?"desktop":window.innerWidth>600?"tablet":"mobile"}))}if(s==="true"){var b=window.location.hash;if(b){g()}window.addEventListener("hashchange",function(){g()})}else{g()}if(a==="true"){window.mp=function(t,o){var p=new XMLHttpRequest();p.open("POST",n,true);p.setRequestHeader("Content-Type","application/json");p.send(JSON.stringify({site_id:e,name:t,url:i,props:o||{}}))}}})();`;

  return `<!-- Mini Plausible Analytics -->\n<script defer data-site-id="${siteId}" src="${domain}/tracker.js"></script>\n<script>${scriptContent}</script>\n<!-- End Mini Plausible Analytics -->`;
}

export function generateEmbedTag(options: EmbedOptions): string {
  const {
    siteId,
    domain = "",
    endpoint = "/api/event",
  } = options;

  return `<script defer data-site-id="${siteId}" data-api-endpoint="${domain}${endpoint}" src="${domain}/tracker.js"></script>`;
}

export function generateScriptTag(options: EmbedOptions): string {
  const {
    siteId,
    domain = "",
    endpoint = "/api/event",
  } = options;

  return `<script defer data-site-id="${siteId}" data-api-endpoint="${domain}${endpoint}" src="${domain}/tracker.js"></script>`;
}

