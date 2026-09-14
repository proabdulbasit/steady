export const GTM_ID = "GTM-WXG5XDJ7";
export const SITE_ORIGIN = "https://worksteady.app";

export const GTM_INLINE_SCRIPT = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`;

export function hreflangAlternates(canonical = "/") {
  return {
    canonical,
    languages: {
      "en-US": canonical,
      "x-default": canonical,
    },
  };
}
