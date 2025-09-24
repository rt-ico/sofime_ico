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
<section class="dark-primary-color"><p>
${dict.iforgotInfo?html}
</p></section>
</header>
<main class="">

<form method="post" action="${sid(actionUri)}" enctype="application/x-www-form-urlencoded" accept-charset="UTF-8">

<label for="email">${dict.iforgotMail?html}</label>
<input type="text" id="email" name="email" value="" maxlength="100" placeholder="${dict.iforgotMail?html}" autocorrect="off" autocapitalize="off"/>

<button type="submit" class="accent-color">${dict.actionContinue?html}</button>

</form>

</main>
</body>
</html>