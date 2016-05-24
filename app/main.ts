import {bootstrap}    from '@angular/platform-browser-dynamic';
import {AppComponent} from './app.component';
import {ElasticService} from './shared/elastic.service'
import {HTTP_PROVIDERS} from "@angular/http";

bootstrap(<any>AppComponent, [ElasticService, HTTP_PROVIDERS]);

