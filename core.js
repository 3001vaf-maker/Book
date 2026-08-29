/* Book Core — единый центр навигации и команд приложения. */
(() => {
  const START_ROUTE = "journal";
  const ROUTES = Object.freeze({ journal:"Журнал", schedule:"График", dashboard:"Дашборд", chat:"Чат", settings:"Настройки" });
  const CHILDREN = Object.freeze({ settings:new Set(["profile","work-profile","workplaces"]), dashboard:new Set(["clients","client-data"]) });
  const state = { route:START_ROUTE, stack:[] };
  const app=document.getElementById("app");
  const navItems=[...document.querySelectorAll(".nav-item")];
  function render(){
    const current=state.stack.at(-1);
    if(state.route==="settings"){
      if(current==="profile") window.BookProfile.action("open");
      else if(current==="work-profile") window.BookWorkProfile.action("open");
      else if(current==="workplaces") window.BookWorkplaces.action("open");
      else window.BookSettings.action("open");
    } else if(state.route==="dashboard" && current){
      if(current==="clients" || current==="client-data") window.BookClients.action("open", current==="client-data");
    } else if(state.route==="dashboard") window.BookDashboard.action("open");
    else BookUI.renderScreen(app,ROUTES[state.route]);
    navItems.forEach(item=>{const active=item.dataset.route===state.route;item.classList.toggle("is-active",active);if(active)item.setAttribute("aria-current","page");else item.removeAttribute("aria-current");});
  }
  function navigate(route){if(!Object.hasOwn(ROUTES,route))return;state.route=route;state.stack=[];render();}
  function openChild(child){const allowed=CHILDREN[state.route];if(!allowed?.has(child))return;state.stack.push(child);render();}
  function back(){if(state.stack.length){state.stack.pop();render();return;}navigate(state.route);}
  navItems.forEach(item=>item.addEventListener("click",()=>navigate(item.dataset.route)));
  window.Book=Object.freeze({navigate,openChild,back,routes:ROUTES,get currentRoute(){return state.route;},get currentStack(){return[...state.stack];}});
  render();
})();
