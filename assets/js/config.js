/*
 * Site configuration. Change these values per environment; nothing else in
 * the site hard-codes the address of the E1 cloud.
 *
 * apiBase   The address of the E1 server on Azure (the Container App, or its
 *           custom domain), without a trailing slash, for example
 *           "https://app.lanxtor.com". Empty: the account page shows preview
 *           data and says so, and "Log in" explains that accounts are not
 *           connected yet.
 *
 * appUrl    Where "Open E1 in the browser" goes. Usually the same as apiBase.
 *
 * releases  The release manifest the download area reads (see
 *           docs/AZURE-INTEGRATION.md, "Downloads"): releases.json in the
 *           downloads storage, written by E1's macOS build workflow. When it
 *           cannot be read, the copy in assets/data/releases.json is shown.
 *
 * siteUrl   The public address of this website, without a trailing slash,
 *           for example "https://www.lanxtor.com". Certificate links that
 *           people share and add to LinkedIn are built on it, so they stay
 *           right whichever address the page was opened on. Empty: the
 *           current address is used.
 *
 * linkedinOrgId  The numeric ID of the LANXTOR company page on LinkedIn.
 *           With it, "Add to LinkedIn profile" links the certificate to the
 *           company page (and its logo); empty: LinkedIn shows the name only.
 *
 * The website and the E1 server must share one registrable domain
 * (www.lanxtor.com and app.lanxtor.com), because the sign-in cookie is
 * SameSite=Lax: browsers send it to app.lanxtor.com from www.lanxtor.com,
 * but not from an unrelated domain.
 */
window.E1_CONFIG = {
  apiBase: "https://app.lanxtor.com",
  appUrl: "https://app.lanxtor.com",
  releases: "https://e1downloads.blob.core.windows.net/releases/releases.json",
  siteUrl: "",
  linkedinOrgId: ""
};
