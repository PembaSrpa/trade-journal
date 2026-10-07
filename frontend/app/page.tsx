import { RootRedirect } from "@/components/RootRedirect";

/**
 * Entry point. In the Android app (and on some static hosts) any address without
 * a matching file — e.g. a reload on /settings — is answered with THIS page's
 * HTML. The inline script runs before the app starts: if the address isn't "/",
 * it remembers the requested route and reloads at "/" so the app boots correctly,
 * then <RootRedirect/> continues to the remembered route.
 */
const EARLY = `(function(){try{
var p=location.pathname.replace(/\\/index\\.html$/,"").replace(/\\/+$/,"");
if(p&&p!=="/"){
  var lastPath=sessionStorage.getItem("journal_redirect_path");
  var lastAt=Number(sessionStorage.getItem("journal_redirect_at")||0);
  if(lastPath===p&&Date.now()-lastAt<5000){sessionStorage.removeItem("journal_redirect");location.replace("/");return;}
  sessionStorage.setItem("journal_redirect",p+location.search);
  sessionStorage.setItem("journal_redirect_path",p);
  sessionStorage.setItem("journal_redirect_at",String(Date.now()));
  location.replace("/");
}}catch(e){}})();`;

export default function RootPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EARLY }} />
      <RootRedirect />
    </>
  );
}
