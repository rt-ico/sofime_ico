[#ftl]
<script type="text/javascript">

var require = {
	baseUrl: '${themeMediaUri}js/lib',
	paths: {
        'app': '../app',
		'l20n': '../../../../../api/l20n',
		'routes': '../../../../../api/routes',
        'mt': '../../microtemplate',
		'jquery': 'jquery-3.1.1.min',
		'lodash': 'lodash.min',
		'sprintf': 'sprintf.min',
		'typeahead': 'typeahead.jquery.min',
		'moment': 'moment-with-locales.min',
		'chart': 'Chart.min',
		'ckEditor': 'ckeditor5.umd',
		'emoji': 'ckeditor5-emoji-main/build/@phudak/ckeditor5-emoji.js'
	},
	shim: {
		"Handlebars": {
			exports: "Handlebars"
		}
	}
};

</script>
