import * as Vue from "vue"
// cdn component file

export const SearchDropdown = Vue.defineComponent({
    name: "SearchDropdown",
    props: {
        items: { type: Array, default: () => [] }, // array of primitives or objects
        // modelValue can be a single value/object or an array when multiple selections are used
        modelValue: { type: [Array, String, Number, Object, null], default: null },
        placeholder: { type: String, default: "Search..." },
        clearable: { type: Boolean, default: false },
        // when items are objects, specify which keys to use
        itemLabel: { type: String, default: "label" },
        itemValue: { type: String, default: "value" },
        maxResults: { type: Number, default: null },
        // new prop: allow selecting multiple items when > 1
        maxSelections: { type: Number, default: 1 },
        hasBadges: { type: Boolean, default: false },
        onUpdate: {type: Function, default: null},
        labelText: { type: String, default: "" },
        location: { type: String, default: "bottom" },
        dropdownHeight: { type: String, default: "12rem" }
    },
    emits: ["update:modelValue", "select"],
    setup(props, { emit }) {
        const open = Vue.ref(false);
        const query = Vue.ref("");
        const highlighted = Vue.ref(-1);
        const container = Vue.ref(null);

        const isMultiple = () => Number(props.maxSelections) > 1;

        // convert item to display label
        const labelOf = (it) =>
            it && typeof it === "object" ? it[props.itemLabel] ?? String(it) : String(it);

        const valueOf = (it) =>
            it && typeof it === "object" ? it[props.itemValue] ?? it : it;

        const equals = (a, b) => {
            if (a === b) return true;
            const ta = typeof a, tb = typeof b;
            if (ta === "object" && tb === "object") {
                try {
                    return JSON.stringify(a) === JSON.stringify(b);
                } catch {
                    return false;
                }
            }
            // coerce numbers/strings compare
            return String(a) === String(b);
        };

        // selected holds the actual items (objects or primitives) for display
        const selected = Vue.ref([]);

        const findItemForValue = (val) => {
            // try to find in props.items an item whose value equals val
            const found = props.items.find((it) => equals(valueOf(it), val));
            return found !== undefined ? found : val;
        };

        // initialize selected from modelValue
        Vue.watch(
            () => props.modelValue,
            (nv) => {
                if (isMultiple()) {
                    if (Array.isArray(nv)) {
                        selected.value = nv.map((v) => findItemForValue(v));
                    } else if (nv == null) {
                        selected.value = [];
                    } else {
                        // single value provided, convert to array
                        selected.value = [findItemForValue(nv)];
                    }
                    // keep input query blank when multiple
                    query.value = "";
                } else {
                    // single selection behavior (as before)
                    if (nv == null) {
                        selected.value = [];
                        query.value = "";
                    } else {
                        // if modelValue is array, take first
                        const actual = Array.isArray(nv) ? nv[0] : nv;
                        const found =
                            props.items.find((it) => {
                                const v = valueOf(it);
                                return v === actual || (typeof actual === "object" && JSON.stringify(v) === JSON.stringify(actual));
                            }) ?? (typeof actual === "object" ? null : actual);
                        selected.value = found ? [found] : [actual];
                        query.value = found ? labelOf(found) : String(actual);
                    }
                }
            },
            { immediate: true }
        );

        const filtered = Vue.computed(() => {
            const q = query.value.trim().toLowerCase();
            // exclude already-selected items when multiple
            const isSelectedValue = (it) => selected.value.some((s) => equals(valueOf(s), valueOf(it)));
            let list = props.items.filter((it) => {
                if (isMultiple() && isSelectedValue(it)) return false;
                if (!q) return true;
                return labelOf(it).toLowerCase().includes(q);
            });
            return list.slice(0, props.maxResults ?? list.length);
        });

        const openMenu = () => {
            if(isMultiple() && selected.value.length >= props.maxSelections) {
                open.value = false;
                return;
            };
            open.value = true;
            Vue.nextTick(() => {
                highlighted.value = -1;
            });
        };

        const closeMenu = () => {
            open.value = false;
            highlighted.value = -1;
        };

        const toggleMenu = () => (open.value ? closeMenu() : openMenu());

        const emitModel = () => {
            if (isMultiple()) {
                // emit array of values
                emit(
                    "update:modelValue",
                    selected.value.map((s) => valueOf(s))
                );
            } else {
                emit("update:modelValue", selected.value.length ? valueOf(selected.value[0]) : null);
            }
        };

        const select = (item) => {
            if (isMultiple()) {
                // avoid duplicates
                const exists = selected.value.some((s) => equals(valueOf(s), valueOf(item)));
                if (!exists && selected.value.length < props.maxSelections) {
                    selected.value.push(item);
                    emit("select", item);
                    emitModel();
                }
                // clear query so user can continue searching
                query.value = "";

                // close dropdown if selections equals max
                if(selected.value.length >= props.maxSelections) closeMenu();

                // keep menu open so user can add more, but re-evaluate filtered
                Vue.nextTick(() => {
                    highlighted.value = -1;
                });
            } else {
                selected.value = [item];
                emit("update:modelValue", valueOf(item));
                emit("select", item);
                query.value = labelOf(item);
                closeMenu();
            }

            // call onUpdate callback only if a function was provided.
            // If users pass the prop without v-bind (e.g. on-update="myFn")
            // it will be a string; guard to avoid runtime errors.
            if (typeof props.onUpdate === "function") {
                try {
                    props.onUpdate(selected.value);
                } catch (err) {
                    // don't break the component if callback throws
                    // surface the error for debugging
                    // eslint-disable-next-line no-console
                    console.error("SearchDropdown onUpdate callback error:", err);
                }
            } else if (props.onUpdate != null) {
                // eslint-disable-next-line no-console
                console.warn("SearchDropdown: onUpdate prop provided but is not a function:", props.onUpdate);
            }
        };

        const removeSelected = (idx) => {
            const removed = selected.value.splice(idx, 1)[0];
            emitModel();
            // keep focus open for multiple
            Vue.nextTick(() => {
                highlighted.value = -1;
            });
            return removed;
        };

        const clear = () => {
            if (isMultiple()) {
                selected.value = [];
                emitModel();
                query.value = "";
                closeMenu();
            } else {
                emit("update:modelValue", null);
                selected.value = [];
                query.value = "";
                closeMenu();
            }
        };

        const onKeydown = (e) => {
            if (!open.value && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                openMenu();
                e.preventDefault();
                return;
            }
            if (!open.value) {
                // handle backspace to remove last selected when multiple and query empty
                if (isMultiple() && e.key === "Backspace" && query.value === "" && selected.value.length > 0) {
                    removeSelected(selected.value.length - 1);
                    e.preventDefault();
                }
                return;
            }

            if (e.key === "ArrowDown") {
                highlighted.value = Math.min(highlighted.value + 1, filtered.value.length - 1);
                e.preventDefault();
            } else if (e.key === "ArrowUp") {
                highlighted.value = Math.max(highlighted.value - 1, 0);
                e.preventDefault();
            } else if (e.key === "Enter") {
                if (highlighted.value >= 0 && highlighted.value < filtered.value.length) {
                    select(filtered.value[highlighted.value]);
                    e.preventDefault();
                } else if (filtered.value.length === 1 && query.value.trim() !== "") {
                    // allow selecting the single filtered option with Enter
                    select(filtered.value[0]);
                    e.preventDefault();
                }
            } else if (e.key === "Escape") {
                closeMenu();
                e.preventDefault();
            } else if (isMultiple() && e.key === "Backspace" && query.value === "" && selected.value.length > 0) {
                removeSelected(selected.value.length - 1);
                e.preventDefault();
            }
        };

        // click outside to close
        const onDocumentClick = (e) => {
            if (!container.value) return;
            if (!container.value.contains(e.target)) closeMenu();
        };
        Vue.onMounted(() => document.addEventListener("click", onDocumentClick));
        Vue.onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));

        const menuStyles = Vue.computed(() => {
            // base styles
            const base = { maxHeight: props.dropdownHeight, overflow: 'auto' };
            if (props.location === 'top') {
                return Object.assign(base, { bottom: '100%', top: 'auto', marginBottom: '.125rem' });
            }
            if (props.location === 'left') {
                return Object.assign(base, { right: '100%', left: 'auto', marginRight: '.125rem' });
            }
            if (props.location === 'right') {
                return Object.assign(base, { left: '100%', right: 'auto', marginLeft: '.125rem' });
            }
            return base;
        });

        return {
            open,
            query,
            highlighted,
            filtered,
            container,
            toggleMenu,
            openMenu,
            closeMenu,
            select,
            clear,
            onKeydown,
            labelOf,
            selected,
            removeSelected,
            isMultiple
            ,menuStyles
        };
    },
    template: `
        <div class="mb-2 flex-grow-1" ref="container" :class="{
            'dropup': location === 'top',
            'dropdown': location === 'bottom' || location === '',
            'dropend': location === 'right',
            'dropstart': location === 'left'
        }">
            <div class="input-group align-items-start">
                <!-- badges for selected items (when multiple) -->
                <div v-if="selected.length && hasBadges" class="d-flex flex-wrap gap-1 me-2 align-items-center" style="max-width:50%;">
                    <span
                        v-for="(s, idx) in selected"
                        :key="idx"
                        class="btn btn-outline-secondary text-truncate d-inline-flex align-items-center"
                        style="max-width: 200px;"
                        @click="removeSelected(idx)"
                    >
                        <img v-if="s.Sprite" :src="s.Sprite" style="max-height: 24px" />
                        <span class="me-1">{{ labelOf(s) }}</span>
                        <button type="button" class="btn-close btn-close-white btn-sm" aria-label="Remove" @click="removeSelected(idx)"></button>
                    </span>
                </div>
                <span class="input-group-text" v-if="labelText">{{ labelText }}</span>
                <input
                    type="text"
                    class="form-control"
                    :placeholder="placeholder"
                    v-model="query"
                    @focus="openMenu"
                    @input="openMenu"
                    @keydown="onKeydown"
                    aria-haspopup="listbox"
                    :aria-expanded="open"
                    :readonly="maxSelections > 1 && selected.length >= maxSelections"
                    :disabled="maxSelections > 1 && selected.length >= maxSelections"
                    :title="maxSelections == 1 && selected.length == 1 ? selected[0]?.Description : ''"
                />

                <button v-if="clearable && (query || selected.length)" class="btn btn-outline-secondary" type="button" @click="clear" aria-label="Clear">
                    &times;
                </button>
            </div>

            <ul
                class="dropdown-menu w-100 mt-0"
                :class="{ show: open }"
                role="listbox"
                v-if="open"
                :style="menuStyles"
            >
                <li v-if="filtered.length === 0" class="dropdown-item text-muted small">No results</li>
                <button
                    v-for="(item, idx) in filtered"
                    :key="idx"
                    type="button"
                    class="dropdown-item"
                    :class="{ 'active bg-primary text-white': idx === highlighted }"
                    @mouseenter="highlighted = idx"
                    @mouseleave="highlighted = -1"
                    @mousedown.prevent="select(item)"
                    role="option"
                    :aria-selected="idx === highlighted"
                >
                    <img v-if="item.Sprite" :src="item.Sprite" onerror="this.onerror=null; this.src='./resources/images/Moves/STATUS.png'" />
                    {{ labelOf(item) }}
                </button>
            </ul>
        </div>
    `
});