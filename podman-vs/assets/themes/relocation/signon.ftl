[#ftl]
[#assign dict = dictionary.web]
[#assign uafail = (fail?has_content && fail == 'ua')]
<!DOCTYPE html>
<html lang="${dict.dictionaryLocale}">
<head>
<meta name="robots" content="noindex,nofollow" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>${appName?html}</title>
<link rel="stylesheet" type="text/css" media="screen" href="${themeMediaUri}font/montserrat/montserrat.css"/>
<link rel="stylesheet" type="text/css" href="${commonStyleUri}normalize.min.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}palette.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}common.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}signon.css"/>
<link rel="shortcut icon" type="image/x-icon" href="${themeStyleUri}media/favicon.png"/>
[#if !uafail]<!--[if lt IE 9]>
<script type="text/javascript">
if ("?fail=ua" !== location.search) location.replace("?fail=ua");
</script>
<![endif]-->
[#include "share/require.ftl"]
<script type="text/javascript" src="${themeMediaUri}js/lib/require.min.js" data-main="${themeMediaUri}js/signon.js"></script>
[/#if]
</head>
<body class="fit-container[#if fail?has_content] warn[/#if]">
[#if uafail]
<h1>${dict.signOnFailUserAgent?html}</h1>
<p><script type="text/javascript">
document.write(navigator.userAgent);
</script></p>
[#else]
<header class="default-primary-color text-primary-color">
<section> [#--
<h1>${dict.signOnTitle?html}</h1>
<h2>${dict.signOnSubtitle?html}</h2>
--]</section>
<section class="dark-primary-color"><p>
[#if fail?has_content && fail == 'authentication']
${dict.signOnFailAuthn?html}
[#elseif fail?has_content && fail == 'authorization']
${dict.signOnFailAuthz?html}
[#else]
${dict.signOnInfo?html}
[/#if]
</p></section>
</header>
<main class="">

<form method="post" action="${sid(actionUri)}" enctype="application/x-www-form-urlencoded" accept-charset="UTF-8">
<input type="hidden" name="hashUri" value="">

<label for="${paramUsername}">${dict.signOnUsername?html}</label>
<input type="text" id="${paramUsername}" name="${paramUsername}" value="" maxlength="100" placeholder="${dict.signOnUsername?html}" autocorrect="off" autocapitalize="off"/>

<label for="${paramPassword}">${dict.signOnPassword?html}</label>
<input type="password" id="${paramPassword}" name="${paramPassword}" value="" maxlength="100" placeholder="${dict.signOnPassword?html}"/>

<button type="submit" class="accent-color">${dict.signOnConnectAction?html}</button>

</form>

<p class="iforgot"><a class="underlined" href="${contextUri}iforgot">${dict.signOnRecoverPasswordAction?html}</a></p>

</main>
[/#if]
</body>
</html>