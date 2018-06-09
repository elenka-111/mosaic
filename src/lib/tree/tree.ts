import { NodeDef, ViewData } from '@angular/core/src/view';
import { SelectionModel } from '@ptsecurity/cdk/collections';
import { CanDisable, HasTabIndex, mixinDisabled, mixinTabIndex, toBoolean } from '@ptsecurity/mosaic/core';

import {
    AfterContentInit,
    Attribute,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component, ContentChildren, EventEmitter, forwardRef, Input, IterableDiffer,
    IterableDiffers, Output, QueryList,
    ViewChild,
    ViewEncapsulation
} from '@angular/core';

import { FocusKeyManager } from '@ptsecurity/cdk/a11y';
import { CdkTree, CdkTreeNodeOutlet } from '@ptsecurity/cdk/tree';

import { END, ENTER, HOME, LEFT_ARROW, PAGE_DOWN, PAGE_UP, RIGHT_ARROW, SPACE } from '@ptsecurity/cdk/keycodes';

import { McTreeNodeOption } from './node-option';


export const _McTreeSelectionBase = mixinTabIndex(mixinDisabled(CdkTree));

export class McTreeNavigationChange {
    constructor(
        public source: McTreeSelection<any>,
        public option: McTreeNodeOption<any>
    ) {}
}

export class McTreeSelectionChange {
    constructor(
        public source: McTreeSelection<any>,
        public option: McTreeNodeOption<any>
    ) {}
}

/**
 * Wrapper for the CdkTable with Material design styles.
 */
@Component({
    exportAs: 'mcTreeSelection',
    selector: 'mc-tree-selection',
    template: `<ng-container cdkTreeNodeOutlet></ng-container>`,
    host: {
        '[tabIndex]': 'tabIndex',
        class: 'mc-tree',
        role: 'tree-selection',
        '(keydown)': '_onKeyDown($event)'
    },
    styleUrls: ['./tree.css'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [{ provide: CdkTree, useExisting: McTreeSelection }]
})
export class McTreeSelection<T> extends _McTreeSelectionBase<T>
    implements AfterContentInit, CanDisable, HasTabIndex {
    // Outlets within the tree's template where the dataNodes will be inserted.
    @ViewChild(CdkTreeNodeOutlet) _nodeOutlet: CdkTreeNodeOutlet;

    @ContentChildren(forwardRef(() => McTreeNodeOption)) options: QueryList<McTreeNodeOption<T>>;

    _keyManager: FocusKeyManager<McTreeNodeOption<T>>;

    selectedOptions: SelectionModel<McTreeNodeOption<T>>;

    _disabled: boolean = false;
    tabIndex: number;
    multiple: boolean;
    autoSelect: boolean;

    @Input()
    get disabled(): boolean {
        return this._disabled;
    }

    set disabled(rawValue: boolean) {
        const value = toBoolean(rawValue);

        if (this._disabled !== value) {
            this._disabled = value;

            if (this._disabled) {
                console.log('need disable all options');
            } else {
                console.log('need enable all options');
            }
        }
    }

    @Output() readonly navigationChange = new EventEmitter<McTreeNavigationChange>();

    @Output() readonly selectionChange = new EventEmitter<McTreeSelectionChange>();

    constructor(
        _differs: IterableDiffers,
        _changeDetectorRef: ChangeDetectorRef,
        @Attribute('tabindex') tabIndex: string,
        @Attribute('multiple') multiple: string,
        @Attribute('auto-select') autoSelect: string
    ) {
        super(_differs, _changeDetectorRef);

        this.tabIndex = parseInt(tabIndex) || 0;

        this.multiple = multiple === null ? true : toBoolean(multiple);
        this.autoSelect = autoSelect === null ? true : toBoolean(autoSelect);

        this.selectedOptions = new SelectionModel<McTreeNodeOption<T>>(this.multiple);
    }

    _onKeyDown(event: KeyboardEvent) {
        const keyCode = event.keyCode;

        switch (keyCode) {
            case LEFT_ARROW:
                this.treeControl.collapse(this._keyManager.activeItem.data);
                event.preventDefault();

                break;
            case RIGHT_ARROW:
                this.treeControl.expand(this._keyManager.activeItem.data);
                event.preventDefault();

                break;
            case SPACE:
            case ENTER:
                this.toggleFocusedOption();

                event.preventDefault();

                break;
            case HOME:
                console.log('need set focus on first node');
                event.preventDefault();

                break;
            case END:
                console.log('need set focus on last node');
                event.preventDefault();

                break;
            case PAGE_UP:
                console.log('need do scroll page and set focus on first in viewport');

                event.preventDefault();

                break;
            case PAGE_DOWN:
                console.log('need do scroll page and set focus on last in viewport');

                event.preventDefault();

                break;
            default:
                this._keyManager.onKeydown(event);
        }
    }

    ngAfterContentInit(): void {
        this._keyManager = new FocusKeyManager<McTreeNodeOption<T>>(this.options)
            .withTypeAhead()
            .withVerticalOrientation(true)
            .withHorizontalOrientation(null);
    }

    setFocusedOption(option: McTreeNodeOption<T>) {
        this._keyManager.updateActiveItem(option);

        if (this.autoSelect) {
            this.options.forEach((item) => item.setSelected(false));
            option.setSelected(true);
        }

        this._emitNavigationEvent(option);
    }

    // Toggles the selected state of the currently focused option.
    toggleFocusedOption(): void {
        const focusedIndex = this._keyManager.activeItemIndex;

        if (focusedIndex != null && this._isValidIndex(focusedIndex)) {
            const focusedOption: McTreeNodeOption<T> = this.options.toArray()[focusedIndex];

            if (focusedOption && this._canUnselectLast(focusedOption)) {
                focusedOption.toggle();

                // Emit a change event because the focused option changed its state through user interaction.
                this._emitChangeEvent(focusedOption);
            }
        }
    }

    renderNodeChanges(
        data: T[],
        dataDiffer: IterableDiffer<T> = this._dataDiffer,
        viewContainer: any = this._nodeOutlet.viewContainer,
        parentData?: T
    ) {
        super.renderNodeChanges(data, dataDiffer, viewContainer, parentData);

        const arrayOfInstances = [];

        viewContainer._embeddedViews.forEach((view: ViewData) => {
            const viewDef = view.def;

            viewDef.nodes.forEach((node: NodeDef) => {
                if (viewDef.nodeMatchedQueries === node.matchedQueryIds) {
                    const nodeData = view.nodes[node.nodeIndex] as any;

                    arrayOfInstances.push(nodeData.instance);
                }
            });
        });

        if (this.options) {
            this.options.reset(arrayOfInstances);
            this.options.notifyOnChanges();
        }
    }

    _emitNavigationEvent(option: McTreeNodeOption<T>): void {
        this.navigationChange.emit(new McTreeNavigationChange(this, option));
    }

    _emitChangeEvent(option: McTreeNodeOption<T>): void {
        this.selectionChange.emit(new McTreeNavigationChange(this, option));
    }

    /**
     * Utility to ensure all indexes are valid.
     * @param index The index to be checked.
     * @returns True if the index is valid for our list of options.
     */
    private _isValidIndex(index: number): boolean {
        return index >= 0 && index < this.options.length;
    }

    private _canUnselectLast(option: McTreeNodeOption<T>): boolean {
        return true;
        // return !(this.noUnselect && this.selectedOptions.selected.length === 1 && listOption.selected);
    }
}

