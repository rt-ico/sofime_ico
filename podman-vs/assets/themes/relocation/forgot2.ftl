[#ftl]
[#assign dict = dictionary.directory]
<!DOCTYPE html>
<html lang="${dict.dictionaryLocale}">
<head>
<meta name="robots" content="noindex,nofollow" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>${dict.iforgotTitle?html}</title>
<link rel="stylesheet" type="text/css" media="screen" href="${themeMediaUri}font/montserrat/montserrat.css"/>
<link rel="stylesheet" type="text/css" href="${commonStyleUri}normalize.min.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}palette.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}common.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}signon.css"/>
<link rel="shortcut icon" type="image/x-icon" href="${themeStyleUri}media/favicon.png"/>
[#include "share/require.ftl"]
<script type="text/javascript" src="${themeMediaUri}js/lib/require.min.js" data-main="${themeMediaUri}js/iforgot.js"></script>
</head>
<body class="fit-container[#if fail?has_content] warn[/#if]">
<header class="default-primary-color text-primary-color">
<section>
<h2>${dict.iforgotTitle?html}</h2>
</section>
<section class="dark-primary-color"><p> </p></section>
</header>
<main class="">

<p>[#if resetValidated]${dict.iforgotValidated?html}[#elseif resetRejected]${dict.iforgotRejected?html}[#else]${dict.iforgotAcknowledged?html}[/#if]</p>

<p><a class="underlined" href="${contextUri}signon">${dict.actionBackToStart?html}</a></p>

</main>
</body>
</html>