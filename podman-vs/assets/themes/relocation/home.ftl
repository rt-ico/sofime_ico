[#ftl]
[#assign dict = dictionary.web]
<!DOCTYPE html>
<html lang="${locale.language}">
<head>
<meta name="robots" content="noindex,nofollow" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<title>${dict.appName?html}</title>
<link rel="stylesheet" type="text/css" media="screen" href="${themeMediaUri}font/montserrat/montserrat.css"/>
<link rel="stylesheet" type="text/css" href="${commonStyleUri}normalize.min.css"/>

<link rel="stylesheet" type="text/css" href="${commonStyleUri}third/print.min.css"/>
<script type="text/javascript" src="${themeMediaUri}js/third/print.min.js"></script>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.6.0/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.6.0/dist/leaflet.js"></script>

<link rel="stylesheet" type="text/css" href="${themeStyleUri}palette.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}common.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}home.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}ckeditor5.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}ckeditor5-content.css"/>
<link rel="stylesheet" type="text/css" href="${themeStyleUri}ckeditor5-editor.css"/>
<link rel="shortcut icon" type="image/x-icon" href="${themeStyleUri}media/favicon.png"/>
[#include "share/require.ftl"]

<script type="text/javascript" src="${themeMediaUri}js/lib/require.min.js" data-main="${themeMediaUri}js/sofime.js"></script>
</head>
<body class="fit-container [#-- with-header with-footer with-nav--]">

<div class="splash opaque"><p><img src="${themeStyleUri}media/splash.png" alt="${dict.appName?html}"></p></div>

<header>
<h1 class="title ellipsis"> </h1>
[#--<div class="search"></div>--]
<div class="nav-ctl dark-primary-color text-primary-color">[#--
--]<a href="#maximize"><img src="${themeStyleUri}media/white1x/menu-hamburger.png" class="sidebar-toggle" title="${dict.maximizeSidebar?html}"
     srcset="${themeStyleUri}media/white1x/menu-hamburger.png 1x, ${themeStyleUri}media/white2x/menu-hamburger.png 2x"></a>[#--
--]</div>
<div class="hdr-ctl">[#--
-- ]<img src="${themeStyleUri}media/black1x/magnifying_glass.png" class="sidebar-toggle" title="${dict.maximizeSidebar?html}"
     srcset="${themeStyleUri}media/black1x/magnifying_glass.png 1x, ${themeStyleUri}media/black2x/magnifying_glass.png 2x"
  data-mode="maximize">[ #--
--]<a href="${contextUri}signoff"><img src="${themeStyleUri}media/black1x/standby.png" title="${dict.signOff?html}"
     srcset="${themeStyleUri}media/black1x/standby.png 1x, ${themeStyleUri}media/black2x/standby.png 2x"></a>[#--
--]</div>
</header>

<nav class="default-primary-color text-primary-color">
<div class="light-primary-color primary-text-color inactive nav-ctl">[#--
--]<a href="#minimize"><img src="${themeStyleUri}media/black1x/menu-hamburger.png" class="sidebar-toggle" title="${dict.minimizeSidebar?html}"
     srcset="${themeStyleUri}media/black1x/menu-hamburger.png 1x, ${themeStyleUri}media/black2x/menu-hamburger.png 2x"></a>[#--
--][#if profile == "SF" || profile == "CT"]<span class="user-cn ellipsis fit-container">${userName(user)?html}</span>[/#if][#--
--]</div>
<div class="nav-box">
[#if profile == "XP"]
<ul class="nav-menu default-text-shadow text-only">
<li tabindex="0" title="${dict.navMyAccount?html}" class="account non-default"><a href="#expatAccount">${userName(user)?html}</a></li>
</ul>
[#elseif profile == "HR"]
<ul class="nav-menu default-text-shadow text-only">
<li tabindex="0" title="${dict.navMyAccount?html}" class="account non-default"><a href="#hrAccount">${userName(user)?html}</a></li>
</ul>
[/#if]
<ul class="nav-menu default-text-shadow">
[#if profile == "XP"]
    <li tabindex="0" title="${dict.navHome?html}" class="expatMain"><a href="#expatMain">${dict.navHome?html}</a></li>
    <li class="separator"><hr></li>
    <li tabindex="0" title="${dict.navExpatRelocation?html}" class="expatRelocation"><span class="badge accent-color text-primary-color zero">0</span><a href="#expatRelocation">${dict.navExpatRelocation?html}</a></li>
    <li tabindex="0" title="${dict.navOtherVisits?html}" class="otherVisits"><span class="badge accent-color text-primary-color zero">0</span><a href="#otherVisits">${dict.navOtherVisits?html}</a></li>
    [#if showHomeSearch?has_content && showHomeSearch]
    <li tabindex="0" title="${dict.navExpatVisits?html}" class="expatVisits"><span class="badge accent-color text-primary-color zero">0</span><a href="#expatVisits">${dict.navExpatVisits?html}</a></li>
    [/#if]
    <li tabindex="0" title="${dict.navExpatDocs?html}" class="expatDocs"><span class="badge accent-color text-primary-color zero">0</span><a href="#expatDocs">${dict.navExpatDocs?html}</a></li>
    <li tabindex="0" title="${dict.navExpatGuides?html}" class="expatGuides"><a href="#expatGuides">${dict.navExpatGuides?html}</a></li>
    <li class="separator"><hr></li>
    <li tabindex="0" title="${dict.navContacts?html}" class="expatContacts"><a href="#expatContacts">${dict.navContacts?html}</a></li>
[#--
    <li tabindex="0" title="${dict.navExpats?html}"><a href="#expats">${dict.navExpats?html}</a></li>
    <li tabindex="0" title="${dict.navExpatPhotos?html}"><a href="#expatPhotos">${dict.navExpatPhotos?html}</a></li>
--]
[#elseif profile == 'HR']
    <li tabindex="0" title="${dict.navHome?html}" class="hrHome"><a href="#hrHome">${dict.navHome?html}</a></li>
    <li class="separator"><hr></li>
    <li tabindex="0" title="${dict.navHrReloSetup?html}" class="hrReloSetup"><a href="#hrReloSetup">${dict.navHrReloSetup?html}</a></li>
    <li tabindex="0" title="${dict.navHrPlanning?html}" class="hrPlanning"><a href="#hrPlanning">${dict.navHrPlanning?html}</a></li>
    <li tabindex="0" title="${dict.navHrReloTrack?html}" class="hrReloTrack"><a href="#hrReloTrack">${dict.navHrReloTrack?html}</a></li>
    <li tabindex="0" title="${dict.navHrSfServices?html}" class="hrSfServices"><a href="#hrSfServices">${dict.navHrSfServices?html}</a></li>
    <li tabindex="0" title="${dict.navStats?html}" class="hrStats"><a href="#hrStats">${dict.navStats?html}</a></li>
    <li class="separator"><hr></li>
    <li tabindex="0" title="${dict.navContacts?html}" class="hrContacts"><a href="#hrContacts">${dict.navContacts?html}</a></li>
[#elseif profile == 'SF' || profile = 'CT']
    <li tabindex="0" title="${dict.navSfTodo?html}" class="sfTodo non-default"><a href="#sfTodo">${dict.navSfTodo?html}</a></li>
    <li tabindex="0" title="${dict.navSfMemo?html}" class="sfMemo non-default"><a href="#sfMemo">${dict.navSfMemo?html}</a></li>
    <li tabindex="0" title="${dict.navSofimeExpats?html}" class="sfRelos"><span class="badge accent-color text-primary-color zero">0</span><a href="#sofimeExpats">${dict.navSofimeExpats?html}</a></li>
    <li tabindex="0" title="${dict.navSfSuppliers?html}" class="sfSuppliers"><a href="#sfSuppliers">${dict.navSfSuppliers?html}</a></li>
	[#if profile == 'SF']
    <li tabindex="0" title="${dict.navSurveys?html}" class="activeSurveys"><span class="badge accent-color text-primary-color zero">0</span><a href="#activeSurveys">${dict.navSurveys?html}</a></li>
	[/#if]
    <li tabindex="0" title="${dict.navSfMessages?html}" class="sfMessages"><a href="#sfMessages">${dict.navSfMessages?html}</a></li>
[/#if]
</ul>[#--
--]</div>[#-- .nav-box
--]<div class="dark-primary-color l7n-ctl">[#--
--]<span class="user-locale ellipsis fit-container"><a href="${contextUri}locale/${nextLocaleCode(user)}"><img src="${themeStyleUri}media/flag/${nextLocaleCode(user)}.png"><span>${nextLocaleName(user)?html}</span></a></span>[#--
--]</div>[#-- .l7n-ctl
--]</nav>

<main></main>

<footer>
</footer>

</body>
</html>