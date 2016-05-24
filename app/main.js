"use strict";
var platform_browser_dynamic_1 = require('@angular/platform-browser-dynamic');
var app_component_1 = require('./app.component');
var elastic_service_1 = require('./shared/elastic.service');
var http_1 = require("@angular/http");
platform_browser_dynamic_1.bootstrap(app_component_1.AppComponent, [elastic_service_1.ElasticService, http_1.HTTP_PROVIDERS]);
//# sourceMappingURL=main.js.map