"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
/**
 * Created by silvia on 26/2/16.
 */
var core_1 = require('@angular/core');
var main_1 = require('ag-grid-ng2/main');
var DateUtils_1 = require('./shared/DateUtils');
var elastic_service_1 = require("./shared/elastic.service");
var angular2_tree_component_1 = require('angular2-tree-component');
var AppComponent = (function () {
    function AppComponent(_elasticService) {
        this._elasticService = _elasticService;
        this.defaultFrom = new Date(new Date().valueOf() - (10 * 60 * 60 * 1000));
        this.defaultTo = new Date(new Date().valueOf() - (1 * 60 * 60 * 1000));
        this.showLoadMore = false;
        // we pass an empty gridOptions in, so we can grab the api out
        this.gridOptions = {};
        //this.rowData=[];
        this.createColumnDefs();
        this.showGrid = true;
        this.searchByRelevance = false;
        this.errorMessage = "";
        this.nodes = [
            {
                name: 'root1',
                children: [
                    { name: 'child1' },
                    { name: 'child2' }
                ]
            },
            {
                name: 'root2',
                children: [
                    { name: 'child2.1' },
                    {
                        name: 'child2.2',
                        children: [
                            { name: 'subsub' }
                        ]
                    }
                ]
            }
        ];
    }
    AppComponent.prototype.ngAfterContentInit = function () {
        this.createRowData();
    };
    AppComponent.prototype.createRowData = function () {
        var _this = this;
        //this.gridOptions.api.showLoadingOverlay();
        this.rowData = [];
        this._elasticService.getRowsDefault()
            .subscribe(function (res) {
            //this.gridOptions.api.hideOverlay(); TODO it breaks the test
            _this.rowData = _this.rowData.concat(res);
            _this.rowData = _this.rowData.slice();
        }, function (err) { return console.log("Error in default fetching" + err); }, function (complete) { return _this.subscribeComplete(); });
    };
    AppComponent.prototype.search = function (input) {
        var _this = this;
        this.gridOptions.api.showLoadingOverlay();
        this.rowData = []; //RESTART ROW DATA or it will be appended after default rows
        this._elasticService.search(input, this.searchByRelevance).subscribe(function (res) {
            _this.gridOptions.api.hideOverlay();
            _this.rowData = _this.rowData.concat(res);
            _this.rowData = _this.rowData.slice();
        }, function (err) { return console.log("Error in search" + err); }, function (complete) { return _this.subscribeComplete(); });
    };
    AppComponent.prototype.mark = function (input) {
        var i = 0;
        for (var _i = 0, _a = this.rowData; _i < _a.length; _i++) {
            var row = _a[_i];
            if (!row.marked) {
                for (var field in row) {
                    if (row.hasOwnProperty(field) && field != "marked") {
                        if (row[field].toLowerCase().indexOf(input.toLowerCase()) != -1) {
                            this.rowData[i].marked = true;
                            break;
                        }
                        else {
                            this.rowData[i].marked = false;
                        }
                    }
                }
            }
            i++;
        }
        this.currentFilter = input;
        this.gridOptions.api.softRefreshView();
    };
    AppComponent.prototype.loadByDate = function (to, from) {
        var _this = this;
        if (from < to) {
            this.gridOptions.api.showLoadingOverlay();
            this.rowData = [];
            this._elasticService.loadByDate(to, from).subscribe(function (res) {
                _this.gridOptions.api.hideOverlay();
                _this.rowData = _this.rowData.concat(res);
                _this.rowData = _this.rowData.slice();
            }, function (err) { return console.log("Error in loading by date" + err); }, function (complete) { return _this.subscribeComplete(); });
        }
        else {
            this.errorMessage = "Please be sure that the 'to' field is not earlier than 'from' field";
        }
    };
    AppComponent.prototype.loadMore = function () {
        var _this = this;
        this.gridOptions.api.showLoadingOverlay();
        var r = this.rowCount.split("/"); //Number of displayed logs comes from the grid
        var lastLog = this.rowData[parseInt(r[0]) - 1];
        this._elasticService.loadMore(lastLog).subscribe(function (res) {
            _this.gridOptions.api.hideOverlay();
            _this.rowData = _this.rowData.concat(res);
            _this.rowData = _this.rowData.slice();
        }, function (err) { return console.log("Error in further fetching" + err); }, function (complete) { return _this.subscribeComplete(); });
    };
    AppComponent.prototype.subscribeComplete = function () {
        console.log("Done");
        //Need to apply the marker
        if (this.currentFilter) {
            this.mark(this.currentFilter);
        }
        if (this.rowData.length > 49) {
            this.showLoadMore = true;
        }
        this.errorMessage = "";
    };
    AppComponent.prototype.createColumnDefs = function () {
        var logLevel = function (params) {
            if (params.data.level === 'ERROR') {
                return 'log-level-error ';
            }
            else if (params.data.level === 'WARN') {
                return 'log-level-warn ';
            }
            else {
                return '';
            }
        };
        var marked = function (params) {
            if (params.data.marked) {
                return 'markedInFilter';
            }
        };
        this.columnDefs = [
            {
                headerName: 'Time',
                width: 200,
                checkboxSelection: false,
                field: "time",
                pinned: false,
                volatile: true,
                cellClass: marked
            },
            {
                headerName: 'L',
                width: 60,
                checkboxSelection: false,
                field: "level",
                pinned: false,
                volatile: true,
                cellClass: function (params) {
                    return [logLevel(params), marked(params)];
                }
            },
            {
                headerName: 'Type',
                width: 60,
                checkboxSelection: false,
                field: "type",
                pinned: false,
                volatile: true,
                cellClass: marked
            },
            {
                headerName: 'Thread',
                width: 170,
                checkboxSelection: false,
                field: "thread",
                pinned: false,
                volatile: true,
                cellClass: marked
            },
            {
                headerName: 'Message',
                width: 600,
                checkboxSelection: false,
                field: "message",
                pinned: false,
                volatile: true,
                cellClass: marked
            },
            {
                headerName: 'Logger',
                width: 300,
                checkboxSelection: false,
                field: "logger",
                pinned: false,
                volatile: true,
                cellClass: marked
            },
            {
                headerName: 'Host',
                width: 200,
                checkboxSelection: false,
                field: "host",
                pinned: false,
                volatile: true,
                cellClass: marked
            },
            {
                headerName: 'Path',
                width: 300,
                checkboxSelection: false,
                field: "path",
                pinned: false,
                volatile: true,
                cellClass: marked
            }
        ];
    };
    AppComponent.prototype.calculateRowCount = function () {
        if (this.gridOptions.api && this.rowData) {
            var model = this.gridOptions.api.getModel();
            var totalRows = this.rowData.length;
            var processedRows = model.getRowCount();
            this.rowCount = processedRows.toLocaleString() + ' / ' + totalRows.toLocaleString();
        }
    };
    AppComponent.prototype.onModelUpdated = function () {
        console.log('onModelUpdated');
        this.calculateRowCount();
    };
    AppComponent.prototype.onReady = function () {
        console.log('onReady');
        this.calculateRowCount();
    };
    AppComponent.prototype.onCellClicked = function ($event) {
        console.log('onCellClicked: ' + $event.rowIndex + ' ' + $event.colDef.field);
    };
    AppComponent.prototype.onCellValueChanged = function ($event) {
        console.log('onCellValueChanged: ' + $event.oldValue + ' to ' + $event.newValue);
    };
    AppComponent.prototype.onCellDoubleClicked = function ($event) {
        console.log('onCellDoubleClicked: ' + $event.rowIndex + ' ' + $event.colDef.field);
    };
    AppComponent.prototype.onCellContextMenu = function ($event) {
        console.log('onCellContextMenu: ' + $event.rowIndex + ' ' + $event.colDef.field);
    };
    AppComponent.prototype.onCellFocused = function ($event) {
        console.log('onCellFocused: (' + $event.rowIndex + ',' + $event.colIndex + ')');
    };
    AppComponent.prototype.onRowSelected = function ($event) {
        console.log('onRowSelected: ' + $event.node.data.name);
    };
    AppComponent.prototype.onSelectionChanged = function () {
        console.log('selectionChanged');
    };
    AppComponent.prototype.onBeforeFilterChanged = function () {
        console.log('beforeFilterChanged');
    };
    AppComponent.prototype.onAfterFilterChanged = function () {
        console.log('afterFilterChanged');
    };
    AppComponent.prototype.onFilterModified = function () {
        console.log('onFilterModified');
    };
    AppComponent.prototype.onBeforeSortChanged = function () {
        console.log('onBeforeSortChanged');
    };
    AppComponent.prototype.onAfterSortChanged = function () {
        console.log('onAfterSortChanged');
    };
    AppComponent.prototype.onVirtualRowRemoved = function ($event) {
        // because this event gets fired LOTS of times, we don't print it to the
        // console. if you want to see it, just uncomment out this line
        // console.log('onVirtualRowRemoved: ' + $event.rowIndex);
    };
    AppComponent.prototype.onRowClicked = function ($event) {
        console.log('onRowClicked: ' + $event.node.data.time);
    };
    // here we use one generic event to handle all the column type events.
    // the method just prints the event name
    AppComponent.prototype.onColumnEvent = function ($event) {
        console.log('onColumnEvent: ' + $event);
    };
    // AUX METHODS ------------------------------
    AppComponent.prototype.getDefaultFromValue = function () {
        return DateUtils_1.toInputLiteral(this.defaultFrom);
    };
    AppComponent.prototype.getDefaultToValue = function () {
        return DateUtils_1.toInputLiteral(this.defaultTo);
    };
    AppComponent = __decorate([
        core_1.Component({
            selector: 'my-app',
            templateUrl: './app/appcomponent.html',
            directives: [main_1.AgGridNg2, angular2_tree_component_1.TreeComponent],
            styles: ['.toolbar button {margin: 2px; padding: 0px;}'],
        }), 
        __metadata('design:paramtypes', [elastic_service_1.ElasticService])
    ], AppComponent);
    return AppComponent;
}());
exports.AppComponent = AppComponent;
//# sourceMappingURL=app.component.js.map