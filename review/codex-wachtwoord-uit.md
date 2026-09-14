**Ik kan je geen bewezen, algemeen werkend recept geven dat op iOS zonder paginanavigatie altijd ‘Wachtwoord bewaren?’ oproept.** Apple documenteert hoe je een loginformulier herkenbaar maakt, maar geen afdwingbare bewaarvraag met `remove()`, `pushState()` of een bepaalde wachttijd. Beweren dat één van die ingrepen gegarandeerd werkt, zou te stellig zijn.

Korte STORM-check: de onderbouwing hieronder komt uit Apple-documentatie, de HTML-standaard en een historische WebKit-bug. Je exacte iOS-versies en wachtwoordmanagerinstellingen ontbreken. De voorbeelden zijn concrete proefpagina’s, **niet door mij op een iPhone of iPad geverifieerd**.

**Wat in jullie huidige code opvalt**

De eerste wijziging die ik zou testen is het weglaten van:

```js
$('#herstel-code').value = '';
```

Je wist nu het wachtwoord voordat het formulier verdwijnt of de route verandert. Daarmee kan een later werkende bewaarheuristiek een leeg veld aantreffen. Dat leegmaken een wachtwoordmanager kan verstoren is historisch gedocumenteerd in [WebKit-bug 38397](https://bugs.webkit.org/show_bug.cgi?id=38397). **Onzeker:** of dit op jullie iOS-versies daadwerkelijk de oorzaak is.

Verder:

- Het wachtwoordveld mist `name="password"`. Voeg dat toe. Dit is normale formuliermarkup, maar geen bewezen zelfstandige oplossing.
- Het username-veld staat buiten beeld en is uitgesloten van toetsenbordnavigatie en toegankelijkheid. Test eerst met een **zichtbaar, bewerkbaar veld met label**. Daarmee haal je meerdere mogelijke verstoringen tegelijk weg.
- `autocomplete="current-password"` is juist voor een bestaande, herbruikbare deelnemerscode. `new-password` beschrijft het maken of wijzigen van een wachtwoord, niet het herstellen van toegang met een bestaande code. [Apple: autocomplete voor inlogvelden](https://developer.apple.com/documentation/security/enabling-password-autofill-on-an-html-input-element)
- `.trim().toUpperCase()` op een lokale JavaScript-variabele verandert het invoerveld niet. Dat is iets anders dan `input.value = ...`.

Het vaste username `wedstrijd` onderscheidt bovendien geen deelnemers. Mijn ontwerpadvies is een herkenbaar, niet-geheim opslaglabel, bijvoorbeeld een deelnemersnaam. Dat hoeft niet naar jullie RPC. Eén vaste username voor verschillende codes kan onduidelijkheid veroorzaken over welk opgeslagen wachtwoord moet worden bijgewerkt. **Onzeker:** hoe Safari dat in jullie specifieke situatie afhandelt.

**Welke kenmerken zijn nodig, en wat is onzeker?**

| Onderdeel | Concreet advies | Zekerheid |
|---|---|---|
| Formulier | Eén echt `<form>` met username, password en submitknop. | Apple beveelt semantische formulieren aan, ook bij JavaScript-submit. |
| Labels | Koppel zichtbare `<label>`-elementen via `for` aan stabiele `id`’s. | Gedocumenteerd voor betere AutoFill-herkenning. |
| Username | Begin zichtbaar en bewerkbaar, met `autocomplete="username"`. | Token gedocumenteerd. Zichtbaarheid als absolute bewaareis: **onzeker**. |
| Namen | Gebruik `name="username"` en `name="password"`. | Goede standaardmarkup. Deze exacte namen als Safari-vereiste: **onzeker**. |
| Wachtwoord | `type="password" autocomplete="current-password"`. | Gedocumenteerd voor bestaande wachtwoorden. |
| Na mislukte login | Laat formulier en waarden staan; toon een fout. | Logische applicatiekeuze. |
| Na geslaagde SPA-login | Laat waarden intact en verwijder het formulier uit de DOM. | Verdedigbare proefvariant, geen gegarandeerde trigger. |
| Alleen `hidden` | Niet bewezen fout, maar test echte verwijdering afzonderlijk. | Verschil voor de bewaarvraag: **onzeker**. |
| `pushState` / `replaceState` | Alleen gebruiken voor routing. | Geen nieuwe documentlading; geen gedocumenteerd bewaarcommando. |
| Hashwijziging | Geen betrouwbare vervanging voor een documentnavigatie. | Een fragmentwijziging laadt doorgaans geen nieuw document. |
| Timing | Handel direct na bevestigde login; geen magische vertraging. | Een noodzakelijke 100, 500 of 1.000 ms is **niet onderbouwd**. |

De markupadviezen staan in [Apple: Improving AutoFill experiences](https://developer.apple.com/documentation/safari-developer-tools/autofill). Het gedrag van de History-API staat in de [HTML-standaard](https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-history-pushstate).

Apple beschrijft bij de native wachtwoordprovider-API ook een save-event wanneer een formulier wordt ingediend of van het scherm verdwijnt. Dat ondersteunt formulierverdwijning als relevant signaal, maar specificeert **niet** welke DOM-mutatie in Safari een zichtbare bewaarvraag oplevert. Het is evenmin een vanuit jullie JavaScript aanroepbare API. [Apple: ASSavePasswordRequestEvent](https://developer.apple.com/documentation/authenticationservices/assavepasswordrequest/event-swift.enum?changes=_7&language=objc)

**Twee zelfstandige proefpagina’s, gerangschikt naar mijn inschatting**

De rangschikking is een technische inschatting, geen gemeten slagingspercentage. Beide bestanden werken met uitsluitend statische HTTPS-hosting, bijvoorbeeld GitHub Pages. Er is geen backend nodig.

Gebruik uitsluitend fictieve codes. De proef accepteert elke alfanumerieke code van zes tekens en voert dus **geen echte authenticatie** uit. Typ bij de eerste test zowel de naam als de code zelf.

**1. Submit met aansluitend een echte documentnavigatie**

Dit is mijn eerste controleproef omdat de loginpagina daadwerkelijk wordt verlaten. **Deze variant versoepelt jullie eis ‘zonder echte paginanavigatie’.** Er blijft wel maar één HTML-bestand nodig: hetzelfde bestand wordt opnieuw geladen met `?klaar=1`.

De formulierwaarden blijven intact tot de navigatie. Er komen geen inloggegevens in de URL.

Sla op als `proef-navigatie.html`:

```html
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Wachtwoordproef: navigatie</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 30rem;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    label { display: block; margin-top: 1rem; }
    input, button {
      box-sizing: border-box;
      width: 100%;
      padding: .75rem;
      margin-top: .4rem;
      font: inherit;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <main id="app"></main>

  <template id="login">
    <h1>Inloggen</h1>
    <p>Gebruik een fictieve naam en een code van zes letters of cijfers.</p>

    <form id="login-form" method="post" autocomplete="on">
      <label for="username">Deelnemersnaam</label>
      <input id="username" name="username" type="text"
             autocomplete="username" autocapitalize="none"
             spellcheck="false" required>

      <label for="password">Persoonlijke code</label>
      <input id="password" name="password" type="password"
             autocomplete="current-password"
             autocapitalize="characters" spellcheck="false"
             minlength="6" maxlength="6"
             pattern="[A-Za-z0-9]{6}" required>

      <button type="submit">Inloggen</button>
    </form>

    <p id="status" role="status"></p>
  </template>

  <script>
    const app = document.querySelector("#app");
    const url = new URL(location.href);
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;

    if (url.searchParams.get("klaar") === "1") {
      const heading = document.createElement("h1");
      heading.textContent = "Proeflogin voltooid";

      const info = document.createElement("p");
      info.textContent = "Dit is een nieuw geladen document.";

      const retry = document.createElement("a");
      url.searchParams.delete("klaar");
      retry.href = url.href;
      retry.textContent = "Opnieuw testen";

      app.append(heading, info, retry);
    } else {
      app.append(
        document.querySelector("#login").content.cloneNode(true)
      );

      const form = document.querySelector("#login-form");
      const status = document.querySelector("#status");
      let busy = false;

      status.textContent = standalone ? "Modus: standalone" : "Modus: tab";

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy) return;
        busy = true;

        // Alleen een lokale proef, geen echte authenticatie.
        // Vervang dit in productie door de RPC en controleer succes.
        const ok = await Promise.resolve(true);

        if (!ok) {
          busy = false;
          status.textContent = "Inloggen mislukt.";
          return;
        }

        // Niet leegmaken, resetten, verbergen of verwijderen.
        // Alleen een niet-geheime marker gaat in de URL.
        const target = new URL(location.href);
        target.searchParams.set("klaar", "1");
        target.hash = "";
        location.assign(target.href);
      });
    }
  </script>
</body>
</html>
```

**Onzeker:** ook `preventDefault()` gevolgd door `location.assign()` garandeert geen bewaarvraag. Dit is bovendien geen native formulier-POST, maar een JavaScript-navigatie na submit.

Een gewone GET-submit met `name="password"` is geen geschikte productieoplossing: daarmee belandt het wachtwoord in de URL. Daarom gebruikt deze proef die aanpak niet.

**2. Zuivere SPA: formulier verwijderen, waarden niet wissen**

Dit is de eerste variant die ik binnen jullie oorspronkelijke architectuur zou testen. De username en het wachtwoord blijven onaangeroerd. Na de gesimuleerde login verdwijnt het formulier daadwerkelijk uit de DOM.

`pushState()` legt alleen de succesvolle route vast. **Onzeker:** of dit naast de DOM-verwijdering enig positief effect op de bewaarvraag heeft.

Sla op als `proef-spa.html`:

```html
<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Wachtwoordproef: SPA</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 30rem;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    label { display: block; margin-top: 1rem; }
    input, button {
      box-sizing: border-box;
      width: 100%;
      padding: .75rem;
      margin-top: .4rem;
      font: inherit;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <main>
    <h1 id="heading">Inloggen</h1>
    <p>Gebruik een fictieve naam en een code van zes letters of cijfers.</p>

    <form id="login-form" method="post" autocomplete="on">
      <label for="username">Deelnemersnaam</label>
      <input id="username" name="username" type="text"
             autocomplete="username" autocapitalize="none"
             spellcheck="false" required>

      <label for="password">Persoonlijke code</label>
      <input id="password" name="password" type="password"
             autocomplete="current-password"
             autocapitalize="characters" spellcheck="false"
             minlength="6" maxlength="6"
             pattern="[A-Za-z0-9]{6}" required>

      <button type="submit">Inloggen</button>
    </form>

    <p id="status" role="status"></p>
    <button id="retry" type="button" hidden>Opnieuw testen</button>
  </main>

  <script>
    const form = document.querySelector("#login-form");
    const status = document.querySelector("#status");
    const retry = document.querySelector("#retry");
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone === true;

    let busy = false;
    status.textContent = standalone ? "Modus: standalone" : "Modus: tab";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;

      // Alleen een lokale proef, geen echte authenticatie.
      // Vervang dit in productie door de RPC en controleer succes.
      const ok = await Promise.resolve(true);

      if (!ok) {
        busy = false;
        status.textContent = "Inloggen mislukt.";
        return;
      }

      // Geen value = "", reset(), readonly of disabled.
      form.remove();

      // Alleen routing. Geen bewezen opdracht om te bewaren.
      history.pushState(null, "", "#/ingelogd");

      document.querySelector("#heading").textContent =
        "Proeflogin voltooid";
      status.textContent = "Het formulier is uit de DOM verwijderd.";
      retry.hidden = false;
    });

    retry.addEventListener("click", () => {
      history.replaceState(null, "", location.pathname + location.search);
      location.reload();
    });
  </script>
</body>
</html>
```

Test daarna dezelfde SPA-proef nogmaals zonder de `history.pushState(...)`-regel. Zo zie je of de routewijziging op het betreffende toestel verschil maakt. Voeg niet tegelijk een willekeurige timeout toe: dan weet je niet welke wijziging effect had.

**Safari-tab tegenover standalone PWA**

Maak onderscheid tussen **een nieuw wachtwoord bewaren** en **een bestaand wachtwoord aanbieden**. Een werkende AutoFill-knop bewijst niet dat de bewaarvraag ook werkt.

Voor gelijk gedrag van de bewaarvraag in beide omgevingen heb ik geen sluitende Apple-garantie gevonden. **Onzeker:** welke verschillen jullie exacte iOS-versies vertonen. Een zelfstandige webapp heeft bovendien een andere opslagcontext dan de Safari-tab; een WebKit-ontwikkelaar beschrijft die isolatie als bedoeld gedrag. Dat gaat over webopslag, niet over de vraag of dezelfde sleutelhangercredentials kunnen worden aangeboden. [WebKit-bug 181849, commentaar 3](https://bugs.webkit.org/show_bug.cgi?id=181849#c3)

Voor deze proeven:

1. Open het bestand via HTTPS in een gewone Safari-tab.
2. Voeg de loginpagina toe aan het beginscherm en start via dat pictogram.
3. Controleer dat de pagina daadwerkelijk `Modus: standalone` meldt.
4. Test bewaren en later opnieuw invullen afzonderlijk, met Apple Wachtwoorden als gekozen provider en AutoFill ingeschakeld.

De pagina’s bevatten de Apple-meta-tag om een zelfstandige beginschermproef mogelijk te maken. Ze hebben geen serviceworker en testen dus niet jullie offlinegedrag of caching.

**Weigert Safari programmatisch ingevulde wachtwoorden?**

**Een algemene regel ‘Safari weigert alle programmatisch ingevulde wachtwoorden’ kan ik niet onderbouwen.** Andersom kan ik ook niet onderbouwen dat alleen `input.value = code` genoeg is om Safari die code te laten bewaren.

Browser-AutoFill en een JavaScript-toekenning zijn technisch verschillende invoerroutes. WebKit beschrijft daarvoor bijvoorbeeld een aparte interne `setValueForUser`-route. Die bron bewijst het onderscheid, niet een algemeen iOS-bewaarverbod. [WebKit-bug 250989](https://www2.webkit.org/show_bug.cgi?id=250989)

Jullie tweede poging combineert daardoor meerdere onzekerheden: programmatisch voorinvullen, `readonly`, `new-password` en geen documentnavigatie. Uit het falen daarvan kun je niet afleiden welke factor doorslaggevend was. Begin met handmatige invoer in bovenstaande proeven en verander daarna telkens één factor.

**Mijn concrete advies voor v83:** test eerst een zichtbaar username-veld, voeg `name="password"` toe, verwijder het leegmaken van het wachtwoordveld en verwijder na geslaagde RPC het volledige formulier. Behoud `current-password`. Als die SPA-proef faalt en de navigatieproef slaagt, heb je op dat toestel bewijs voor een bruikbare navigatieworkaround. Je hebt dan nog geen bewezen oplossing zonder documentnavigatie.