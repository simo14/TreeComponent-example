/**
 * Created by silvia on 26/2/16.
 */

//Removed map.d import as no necessary
import {Injectable,EventEmitter} from "@angular/core";
import {Http, RequestOptions, RequestMethod, Request} from '@angular/http';
import 'rxjs/add/operator/map';
import {Observable} from "rxjs/Observable";


 const ES_URL = 'http://127.0.0.1:9200/';
 const INDEX = "<logstash-*>";
/*
const ES_URL = 'http://jenkins:jenkins130@elasticsearch.kurento.org:9200/';
const INDEX = "<kurento-*>";*/


@Injectable()
export class ElasticService {


    scroll:string = "";         //Elasticsearch scroll indicator

    fields:{
        level:any,
        logger:any,
        thread:any
    }={
        level:"",
        logger:"",
        thread:""
    };

    private sizeOfPage:number = 10;

    private nResults:number = 0;

    private maxResults:number = 50;

    private currentRequest:RequestOptions = new RequestOptions();

    constructor(private _http: Http) {

    }

    public listIndices() {                     //Never used
        return this._http.get('http://localhost:9200/_stats/index,store')
            .map(res=>res.json())
            .map(res => {
                return Object.getOwnPropertyNames(res.indices);
            });
    }

    public listAllLogs(requestOptions:any, emitter): void {

        this._http.request(new Request(requestOptions))
            .map((responseData)=> { return responseData.json()})        //Important include 'return' keyword
            .map((answer)=> {
                let id = answer._scroll_id;
                this.scroll = id;                //id has to be assigned before mapLogs, which only returns the hits.
                answer=this.mapLogs(answer);
                return answer;
            })
            .subscribe(batch=> {
                this.nResults=this.nResults+this.sizeOfPage;
                emitter.next(batch);
                if(this.nResults<this.maxResults && batch.length==this.sizeOfPage){         //if length is less than size of page there is no need for a scroll
                    let body2 = {
                        "scroll" : "1m",
                        "scroll_id" : this.scroll
                    };
                    let url2 = ES_URL + '_search/scroll';
                    let requestOptions2 = new RequestOptions({
                        method: RequestMethod.Post,
                        url: url2,
                        body: JSON.stringify(body2)
                    });
                    this.listAllLogs(requestOptions2, emitter);
                    return;
                }else {
                    this.nResults=0;
                    emitter.complete();
                }

            });

        return;
    }

    public getRowsDefault() {            //NOTE SCROLL ID! Elasticsearch scroll wouldn't work without it
        let url =ES_URL + INDEX + '/_search?scroll=1m&filter_path=_scroll_id,hits.hits._source,hits.hits._type';
        let body= {
            sort: [
                { "@timestamp": "desc" }
            ],
            query: {
                filtered: {
                    filter: {
                        bool: {
                            must: [
                                {range: {
                                    '@timestamp': {
                                        gte: "now-200d",
                                        lte: "now" }
                                    }
                                },
                                { "bool":{"should": [
                                    { "exists" : { "field" : "thread_name" } },
                                    { "exists" : { "field" : "threadid" } }
                                ]
                                }
                                },
                                { "bool": { "should": [
                                    { "exists" : { "field" : "logger_name" } },
                                    { "exists" : { "field" : "loggername" } }
                                ]
                                }
                                },
                                {   "bool": { "should": [
                                    { "exists" : { "field" : "loglevel" } },
                                    { "exists" : { "field" : "level" } }
                                ]
                                }
                                }
                            ]
                        }
                    }
                }
            },
            size: this.sizeOfPage
            //The following are the fields that are requested from each log. They should be consistent with the definition of logValue
            //_source: ["host", "thread_name", "logger_name", "message", "level", "@timestamp"] 
        };
        let requestOptions = new RequestOptions({
            method: RequestMethod.Post,
            url,
            body: JSON.stringify(body)
        });
        this.currentRequest = requestOptions;

        let observable = Observable.create((observer) => this.listAllLogs(requestOptions, observer));

        return observable;
    }


    public search(value:string, orderByRelevance: boolean) {
        let sort;
        if(orderByRelevance) {
            let options1 = "_score";
            sort = [options1]
        }else{
             let options2 = { '@timestamp': 'desc'};
            sort = [options2];
        }
        let body = {
            "query":{
                "multi_match": {
                    "query":value,
                    "type":"best_fields",
                    "fields": ["type", "host", "message", this.fields.level, this.fields.logger, this.fields.thread],         //Not filter by time: parsing user input would be required
                    "tie_breaker":0.3,
                    "minimum_should_match":"30%"
                }
            },
            size:this.sizeOfPage,
            sort:
                sort

        };
        let url = ES_URL + INDEX + '/_search?scroll=1m';

        let requestOptions2 = new RequestOptions({
            method: RequestMethod.Post,
            url,
            body: JSON.stringify(body)
        });
        if (!orderByRelevance) {            //Fetching more as it is implemented now uses timestamp of the older log
            this.currentRequest = requestOptions2;
        } else {
            this.currentRequest = null;
        }
        let observable = Observable.create((observer) =>
            this.listAllLogs(requestOptions2, observer));

        return observable;
    }


    loadMore(lastLog: any){
        if(this.currentRequest) {
            let lastTime = lastLog.time || lastLog._source["@timestamp"];
            let lessThan = lastTime;
            let greaterThan = lastTime+"||-200d";           //"Date Math starts with an anchor date, which can either be now, or a date string ending with ||. (ElasticSearch)"
            return this.loadByDate(lessThan, greaterThan)
        } else {
            return Observable.create((ob) => {ob.complete()});
        }
    }

    loadByDate(lessThan, greaterThan) {
        let newBody = JSON.parse(this.currentRequest.body);
        let oldRequestGreaterThan;
        let isSearch, notSupported;
        if (newBody.query.hasOwnProperty("multi_match")) {
            let bodyforsearch = {
                "query" :{
                    "filtered" : {
                        "query" : {
                            "multi_match" : newBody.query.multi_match
                        },
                        "filter" : {
                            "range": {
                                '@timestamp': {
                                    "gte": greaterThan,
                                    "lte": lessThan
                                }
                            }
                        }
                    }
                },
                sort: [
                    { "@timestamp": "desc" }
                ]
            };
            newBody=bodyforsearch;
            isSearch=true;

        } else if (newBody.query.filtered.filter.hasOwnProperty('bool')) {
            newBody.query.filtered.filter.bool.must[0].range["@timestamp"] = {
                "gte": greaterThan,
                "lte": lessThan
            };
            oldRequestGreaterThan = JSON.parse(this.currentRequest.body).query.filtered.filter.bool.must[0].range["@timestamp"].gte;
        } else if (newBody.query.filtered.filter.hasOwnProperty("range")){
            //Request was originally a search with a date, so it was modified in the first if, it has different fields.
            newBody.query.filtered.filter.range['@timestamp'] = {
                "gte": greaterThan,
                "lte": lessThan
            }

        } else{
            //Current request does not support load More:
            notSupported = true;
        }
        let loadMoreObservable = Observable.create((observer) => {
            if (!(oldRequestGreaterThan === greaterThan) && !notSupported) {     //Last request and last log match. It means there has been a load more with the same result: no more results to be fetched
                this.currentRequest.body = JSON.stringify(newBody);
                let observableAux = Observable.create((observeraux) => this.listAllLogs(this.currentRequest, observeraux));
                observableAux.subscribe(logs => {
                    observer.next(logs);
                }, (err)=>console.log(err), ()=>{observer.complete()});
            } else {
                //If last log's time (greaterThan) is the same as the last request, it means there were no more results to fetch
                console.log("No more results to fetch or request not supported.");
                observer.complete()
            }
        });
        return loadMoreObservable;
    }

    mapLogs(answer): any[] {
        let result: any[]=[];
        if(answer) {
            for(let a of answer.hits.hits){
                let b=this.elasticLogProcessing(a);
                result.push(b);
            }
        }
        return result;
    }

    elasticLogProcessing(logEntry: any) {
        let type = logEntry._type;
        let time = logEntry._source['@timestamp'];
        let message = logEntry._source.message;
        let level = logEntry._source.level || logEntry._source.loglevel;
        if(logEntry._source.level){
            this.fields.level="level";
        }else{
            this.fields.level="loglevel";
        }
        let thread = logEntry._source.thread_name || logEntry._source.threadid;
        if(logEntry._source.thread_name){
            this.fields.thread="thread_name";
        }else{
            this.fields.thread="threadid";
        }
        let logger = logEntry._source.logger_name || logEntry._source.loggername;
        if(logEntry._source.logger_name){
            this.fields.logger="logger_name";
        }else{
            this.fields.logger="loggername";
        }
        let host = logEntry._source.host;

        let path = logEntry._source.path;

        let logValue = {type, time, message, level, thread, logger, host, path};

        return logValue;
    }
}
