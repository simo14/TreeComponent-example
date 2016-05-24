/**
 * Created by silvia on 26/2/16.
 */
import {Component} from '@angular/core';
import {AgGridNg2} from 'ag-grid-ng2/main';
import {GridOptions} from 'ag-grid/main';
import {toInputLiteral} from './shared/DateUtils';
import {ElasticService} from "./shared/elastic.service";
import { TreeComponent } from 'angular2-tree-component';

@Component({
    selector: 'my-app',
    templateUrl: './app/appcomponent.html',
    directives: [AgGridNg2, TreeComponent],
    styles: ['.toolbar button {margin: 2px; padding: 0px;}'],
})
export class AppComponent {

    public gridOptions:GridOptions;
    private showGrid:boolean;
    public rowData:any[];
    private columnDefs:any[];
    private rowCount:string;
    private showLoadMore:boolean;
    private searchByRelevance:boolean;
    public currentFilter:string;
    public errorMessage:string;

    private defaultFrom = new Date(new Date().valueOf() - (10 * 60 * 60 * 1000));
    private defaultTo = new Date(new Date().valueOf() - (1 * 60 * 60 * 1000));
    
    private nodes:Array<any>;


    constructor(private _elasticService:ElasticService) {
        this.showLoadMore = false;
        // we pass an empty gridOptions in, so we can grab the api out
        this.gridOptions = <GridOptions>{
            //enableServerSideSorting: true
        };
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

    ngAfterContentInit() {         //It needs to be done after the grid api has been set, to be able to use its methods
        this.createRowData();
    }

    public createRowData() {
        //this.gridOptions.api.showLoadingOverlay();
        this.rowData = [];
        this._elasticService.getRowsDefault()
            .subscribe((res)=> {
                    //this.gridOptions.api.hideOverlay(); TODO it breaks the test
                    this.rowData = this.rowData.concat(res);
                    this.rowData = this.rowData.slice();
                }, (err)=>console.log("Error in default fetching" + err),
                (complete) => this.subscribeComplete());
    }

    public search(input:string) {
        this.gridOptions.api.showLoadingOverlay();
        this.rowData = [];                //RESTART ROW DATA or it will be appended after default rows
        this._elasticService.search(input, this.searchByRelevance).subscribe((res)=> {
                this.gridOptions.api.hideOverlay();
                this.rowData = this.rowData.concat(res);
                this.rowData = this.rowData.slice();
            }, (err)=>console.log("Error in search" + err),
            (complete) => this.subscribeComplete());
    }

    public mark(input:string) {
        let i = 0;
        for (let row of this.rowData) {
            if (!row.marked) {
                for (let field in row) {
                    if (row.hasOwnProperty(field) && field != "marked") {        //Check that property doesn't belong to prototype & boolean cannot be searched
                        if (row[field].toLowerCase().indexOf(input.toLowerCase()) != -1) {
                            this.rowData[i].marked = true;
                            break;
                        } else {
                            this.rowData[i].marked = false;
                        }
                    }
                }
            }
            i++;
        }
        this.currentFilter = input;
        this.gridOptions.api.softRefreshView();
    }

    public loadByDate(to:Date, from:Date) {
        if (from < to) {
            this.gridOptions.api.showLoadingOverlay();
            this.rowData = [];
            this._elasticService.loadByDate(to, from).subscribe((res) => {
                    this.gridOptions.api.hideOverlay();
                    this.rowData = this.rowData.concat(res);
                    this.rowData = this.rowData.slice();
                }, (err)=>console.log("Error in loading by date" + err),
                (complete) => this.subscribeComplete());
        } else {
            this.errorMessage = "Please be sure that the 'to' field is not earlier than 'from' field";
        }
    }

    public loadMore() {
        this.gridOptions.api.showLoadingOverlay();
        let r = this.rowCount.split("/");           //Number of displayed logs comes from the grid
        let lastLog = this.rowData[parseInt(r[0]) - 1];

        this._elasticService.loadMore(lastLog).subscribe((res) => {
                this.gridOptions.api.hideOverlay();
                this.rowData = this.rowData.concat(res);
                this.rowData = this.rowData.slice();
            }, (err)=>console.log("Error in further fetching" + err),
            (complete) => this.subscribeComplete());
    }


    private subscribeComplete() {
        console.log("Done");
        //Need to apply the marker
        if (this.currentFilter) {
            this.mark(this.currentFilter);
        }
        if (this.rowData.length > 49) {
            this.showLoadMore = true;
        }
        this.errorMessage = "";
    }

    public createColumnDefs() {
        let logLevel = (params) => {
            if (params.data.level === 'ERROR') {
                return 'log-level-error '
            } else if (params.data.level === 'WARN') {
                return 'log-level-warn '
            } else {
                return '';
            }
        };

        let marked = (params) => {
            if (params.data.marked) {
                return 'markedInFilter'
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
                cellClass: (params) => {
                    return [logLevel(params), marked(params)]
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
    }

    private calculateRowCount() {
        if (this.gridOptions.api && this.rowData) {
            let model = this.gridOptions.api.getModel();
            let totalRows = this.rowData.length;
            let processedRows = model.getRowCount();
            this.rowCount = processedRows.toLocaleString() + ' / ' + totalRows.toLocaleString();
        }
    }

    public onModelUpdated() {
        console.log('onModelUpdated');
        this.calculateRowCount();
    }

    public onReady() {
        console.log('onReady');
        this.calculateRowCount();
    }

    public onCellClicked($event) {
        console.log('onCellClicked: ' + $event.rowIndex + ' ' + $event.colDef.field);
    }

    public onCellValueChanged($event) {
        console.log('onCellValueChanged: ' + $event.oldValue + ' to ' + $event.newValue);
    }

    public onCellDoubleClicked($event) {
        console.log('onCellDoubleClicked: ' + $event.rowIndex + ' ' + $event.colDef.field);
    }

    public onCellContextMenu($event) {
        console.log('onCellContextMenu: ' + $event.rowIndex + ' ' + $event.colDef.field);
    }

    public onCellFocused($event) {
        console.log('onCellFocused: (' + $event.rowIndex + ',' + $event.colIndex + ')');
    }

    public onRowSelected($event) {
        console.log('onRowSelected: ' + $event.node.data.name);
    }

    public onSelectionChanged() {
        console.log('selectionChanged');
    }

    public onBeforeFilterChanged() {
        console.log('beforeFilterChanged');
    }

    public onAfterFilterChanged() {
        console.log('afterFilterChanged');
    }

    public onFilterModified() {
        console.log('onFilterModified');
    }

    public onBeforeSortChanged() {
        console.log('onBeforeSortChanged');
    }

    public onAfterSortChanged() {
        console.log('onAfterSortChanged');
    }

    public onVirtualRowRemoved($event) {
        // because this event gets fired LOTS of times, we don't print it to the
        // console. if you want to see it, just uncomment out this line
        // console.log('onVirtualRowRemoved: ' + $event.rowIndex);
    }

    public onRowClicked($event) {
        console.log('onRowClicked: ' + $event.node.data.time);
    }


    // here we use one generic event to handle all the column type events.
    // the method just prints the event name
    public onColumnEvent($event) {
        console.log('onColumnEvent: ' + $event);
    }

    // AUX METHODS ------------------------------
    getDefaultFromValue() {
        return toInputLiteral(this.defaultFrom);
    }

    getDefaultToValue() {
        return toInputLiteral(this.defaultTo);
    }

}
