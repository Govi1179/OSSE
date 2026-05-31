test
const state = {
  labels: null,
  user: null,
  csrfToken: "",
  profile: null,
  authMode: "login",
  navGroup: "",
  view: "items-list",
  items: [],
  itemSearchFilter: "",
  itemStatusFilter: "",
  itemCategoryFilter: "",
  itemUserFilter: "",
  superAdminCustomIdFilter: "",
  superAdminDcBookFilter: "",
  superAdminDcBookActiveFilter: "all",
  superAdminDcBookDetails: null,
  selectedDcBookId: "",
  superAdminDcBookRecordSearch: "",
  superAdminDcBookRecordStatusFilter: "all",
  superAdminDcBookRecordNumberFilter: "",
  superAdminSection: "overview",
  analyticsSection: "filters",
  orders: [],
  orderSearchFilter: "",
  orderStatusFilter: "",
  orderDeliveryNoFilter: "",
  itemCategories: [],
  volumeUnits: [],
  users: [],
  companies: [],
  companyLocations: [],
  companySetupSelectedCompanyId: "",
  companySetupSelectedLocationId: "",
    customerLocations: [],
    fillerLocations: [],
    customerLocationSelectedId: "",
    customerLocationsViewUserId: "",
    fillerLocationSelectedId: "",
  userSearchFilter: "",
  userRoleFilter: "",
  userActiveFilter: "",
  sessions: [],
  sessionSearchFilter: "",
  sessionActiveFilter: "",
  notifications: [],
  notificationSearchFilter: "",
  notificationTypeFilter: "",
  notificationDeliveryNoFilter: "",
  logs: [],
  logSearchFilter: "",
  logActionFilter: "",
  logDeliveryNoFilter: "",
  activityLogs: [],
  activitySearchFilter: "",
  activityActionFilter: "",
  analytics: null,
  analyticsFilters: {
    analytics_type: "all",
    group_by: "month",
    start_date: "",
    end_date: "",
    user_id: "",
    item_id: "",
    delivery_user_id: "",
    item_status: "all",
    item_fill_state: "all",
    item_warning: "all",
    item_dc_link: "all",
    user_role: "all",
    view_mode: "simple",
    row_limit: "50"
  },
  apiAvailability: {
    analytics: true,
    updateRole: true,
    companySetup: true
  },
  superAdminStats: null,
  backups: [],
  loginControls: [],
  loginControlsUserId: "",
  transitionUsers: [],
  transitionItems: [],
  transitionDcBooks: [],
  transitionDcLinks: [],
  transitionProcesses: [],
  transitionProcessDetails: {},
  transferHistoryExpandedProcessId: "",
  transferHistoryLoadingProcessId: "",
  transitionFlow: {
    step: 1,
    action: "",
    sourceType: "",
    sourceUserId: "",
    sourceLocationId: "",
    dispatchTargetType: "",
    dispatchUserId: "",
    dispatchUserQuery: "",
    dispatchCustomerName: "",
    dcBookId: "",
    linkDcRef: "",
    selectedItemIds: [],
    selectedItemStates: {},
    processId: "",
    pendingProcessId: "",
    pendingAction: ""
  },
  transitionInfoOpen: false,
    formDrafts: {},
  itemStatusPolicy: {
    sequence: [],
    transitions: {}
  },
  lastGeneratedItemCode: "",
  error: "",
  success: "",
  successAcknowledge: null
};

const app = document.getElementById("app");

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBodyObject(body) {
  if (typeof body !== "string" || body.trim().length === 0) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
  if (!isPlainObject(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed;
}

async function api(path, options = {}) {
  const { suppressUnauthorized = false, ...requestOptions } = options;
  const method = String(requestOptions.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH"].includes(method)) {
    parseBodyObject(requestOptions.body);
  }

  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {})
  };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && state.csrfToken) {
    headers["X-CSRF-Token"] = state.csrfToken;
  }

  const response = await fetch(path, {
    credentials: "include",
    headers,
    ...requestOptions
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!isPlainObject(data)) {
    const error = new Error("Invalid API response format");
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401 && !suppressUnauthorized) {
      handleUnauthorized(data.message || "Unauthorized");
      render();
    }
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function resetFeedback() {
  state.error = "";
  state.success = "";
  state.successAcknowledge = null;
}

function getScrollY() {
  return Math.max(0, Number(window.scrollY || document.documentElement.scrollTop || 0));
}

function restoreScrollY(scrollY) {
  if (!Number.isFinite(scrollY)) {
    return;
  }
  window.requestAnimationFrame(() => {
    window.scrollTo(0, Math.max(0, scrollY));
  });
}

function captureActiveElementState() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return null;
  }

  const elementId = String(activeElement.id || "").trim();
  if (!elementId) {
    return null;
  }

  const tagName = String(activeElement.tagName || "").toLowerCase();
  if (!tagName || !["input", "textarea", "select"].includes(tagName)) {
    return null;
  }

  const stateSnapshot = {
    id: elementId,
    tagName,
    selectionStart: null,
    selectionEnd: null
  };

  if (tagName === "input" || tagName === "textarea") {
    const supportsSelection = typeof activeElement.selectionStart === "number" && typeof activeElement.selectionEnd === "number";
    if (supportsSelection) {
      stateSnapshot.selectionStart = activeElement.selectionStart;
      stateSnapshot.selectionEnd = activeElement.selectionEnd;
    }
  }

  return stateSnapshot;
}

function restoreActiveElementState(stateSnapshot) {
  if (!stateSnapshot || !stateSnapshot.id) {
    return;
  }

  const targetElement = document.getElementById(stateSnapshot.id);
  if (!(targetElement instanceof HTMLElement)) {
    return;
  }

  try {
    targetElement.focus({ preventScroll: true });
  } catch {
    targetElement.focus();
  }

  if ((stateSnapshot.tagName === "input" || stateSnapshot.tagName === "textarea") && typeof targetElement.setSelectionRange === "function") {
    if (typeof stateSnapshot.selectionStart === "number" && typeof stateSnapshot.selectionEnd === "number") {
      try {
        targetElement.setSelectionRange(stateSnapshot.selectionStart, stateSnapshot.selectionEnd);
      } catch {
        // Ignore selection restore failures for unsupported input types.
      }
    }
  }
}

function shouldSkipUppercaseForElement(element) {
  if (!element) {
    return true;
  }

  const tagName = String(element.tagName || "").toUpperCase();
  if (!["INPUT", "TEXTAREA"].includes(tagName)) {
    return true;
  }

  const type = String(element.getAttribute("type") || "text").trim().toLowerCase();
  if (["password", "email", "number", "date", "datetime-local", "time", "month", "week", "hidden"].includes(type)) {
    return true;
  }

  const key = `${String(element.getAttribute("name") || "")} ${String(element.getAttribute("id") || "")}`.toLowerCase();
  if (key.includes("email") || key.includes("password") || key.includes("security_key") || key.includes("csrf")) {
    return true;
  }

  return false;
}

function uppercaseElementValuePreservingCursor(element) {
  if (!element || shouldSkipUppercaseForElement(element)) {
    return;
  }

  const original = String(element.value || "");
  const upper = original.toUpperCase();
  if (original === upper) {
    return;
  }

  const hasSelection = typeof element.selectionStart === "number" && typeof element.selectionEnd === "number";
  const start = hasSelection ? element.selectionStart : null;
  const end = hasSelection ? element.selectionEnd : null;
  element.value = upper;

  if (hasSelection && typeof element.setSelectionRange === "function") {
    try {
      element.setSelectionRange(start, end);
    } catch {
      // Ignore selection restore failure for unsupported input types.
    }
  }
}

function bindUppercaseInputPolicy(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") {
    return;
  }

  root.querySelectorAll("input, textarea").forEach((element) => {
    if (element.dataset.uppercasePolicyBound === "1") {
      return;
    }

    if (shouldSkipUppercaseForElement(element)) {
      element.dataset.uppercasePolicyBound = "1";
      return;
    }

    const applyUpper = () => uppercaseElementValuePreservingCursor(element);
    element.addEventListener("input", applyUpper);
    element.addEventListener("change", applyUpper);
    element.addEventListener("blur", applyUpper);
    applyUpper();
    element.dataset.uppercasePolicyBound = "1";
  });
}

function renderPreservingScroll() {
  const scrollY = getScrollY();
  const activeElementState = captureActiveElementState();
  render();
  restoreActiveElementState(activeElementState);
  restoreScrollY(scrollY);
}

let scheduledPreservingRenderFrame = 0;
function scheduleRenderPreservingScroll() {
  if (scheduledPreservingRenderFrame) {
    return;
  }
  scheduledPreservingRenderFrame = window.requestAnimationFrame(() => {
    scheduledPreservingRenderFrame = 0;
    renderPreservingScroll();
  });
}

function handleSuccessfulFormSubmission(form) {
  state.error = "";
  state.success = "Success";
  state.successAcknowledge = () => {
    if (form) {
      form.reset();
    }
  };
  render();
  return true;
}

function renderSuccessModal() {
  if (!state.success) {
    return "";
  }
  return `
      <div class="success-modal-overlay" id="global-success-overlay">
        <div class="success-modal">
          <div class="success-modal-icon">&#10003;</div>
          <div class="success-modal-title">${escapeHtml(state.success)}</div>
          <button type="button" class="success-modal-ok" id="global-success-ok">OK</button>
        </div>
      </div>
    `;
}

function attachGlobalSuccessModal() {
  const globalSuccessOk = document.getElementById("global-success-ok");
  if (!globalSuccessOk) {
    return;
  }
  globalSuccessOk.addEventListener("click", () => {
    const acknowledge = state.successAcknowledge;
    state.success = "";
    state.successAcknowledge = null;
    if (typeof acknowledge === "function") {
      acknowledge();
    }
    render();
  });
}

  function captureCurrentFormDrafts() {
    const forms = Array.from(document.querySelectorAll("form[id]"));
    if (forms.length === 0) {
      return;
    }

    for (const form of forms) {
      const formId = String(form.id || "").trim();
      if (!formId) {
        continue;
      }
      const draft = {};
      const elements = Array.from(form.elements || []);
      for (const element of elements) {
        if (!element || !element.name || element.disabled) {
          continue;
        }
        const key = String(element.name);
        const tagName = String(element.tagName || "").toUpperCase();
        const type = String(element.type || "").toLowerCase();
        if (type === "radio") {
          if (element.checked) {
            draft[key] = String(element.value || "");
          }
          continue;
        }
        if (type === "checkbox") {
          if (!Array.isArray(draft[key])) {
            draft[key] = [];
          }
          if (element.checked) {
            draft[key].push(String(element.value || "on"));
          }
          continue;
        }
        if (tagName === "SELECT" && element.multiple) {
          draft[key] = Array.from(element.selectedOptions || []).map((option) => String(option.value || ""));
          continue;
        }
        draft[key] = String(element.value || "");
      }
      state.formDrafts[formId] = draft;
    }
  }

  function restoreCurrentFormDrafts() {
    const forms = Array.from(document.querySelectorAll("form[id]"));
    if (forms.length === 0) {
      return;
    }

    for (const form of forms) {
      const formId = String(form.id || "").trim();
      if (!formId) {
        continue;
      }
      const draft = state.formDrafts[formId];
      if (!draft || typeof draft !== "object") {
        continue;
      }

      for (const [name, storedValue] of Object.entries(draft)) {
        const elements = Array.from(form.elements || []).filter((element) => element && element.name === name);
        if (elements.length === 0) {
          continue;
        }

        for (const element of elements) {
          const tagName = String(element.tagName || "").toUpperCase();
          const type = String(element.type || "").toLowerCase();
          if (type === "radio") {
            element.checked = String(storedValue || "") === String(element.value || "");
            continue;
          }
          if (type === "checkbox") {
            const checkedValues = Array.isArray(storedValue) ? storedValue.map((value) => String(value)) : [];
            element.checked = checkedValues.includes(String(element.value || "on"));
            continue;
          }
          if (tagName === "SELECT" && element.multiple) {
            const selectedValues = new Set(Array.isArray(storedValue) ? storedValue.map((value) => String(value)) : []);
            for (const option of Array.from(element.options || [])) {
              option.selected = selectedValues.has(String(option.value || ""));
            }
            continue;
          }
          element.value = typeof storedValue === "string" ? storedValue : String(storedValue ?? "");
        }
      }
    }
  }

function renderWithError(message) {
  state.error = message;
  state.success = "";
  render();
}

function clearAuthenticatedState() {
  state.user = null;
  state.csrfToken = "";
  state.profile = null;
  state.items = [];
  state.orders = [];
  state.itemCategories = [];
  state.volumeUnits = [];
  state.users = [];
  state.sessions = [];
  state.notifications = [];
  state.logs = [];
  state.activityLogs = [];
  state.analytics = null;
  state.superAdminStats = null;
  state.backups = [];
  state.loginControls = [];
  state.loginControlsUserId = "";
  state.transitionUsers = [];
  state.transitionItems = [];
  state.transitionDcBooks = [];
  state.transitionDcLinks = [];
  state.transitionProcesses = [];
  state.transitionProcessDetails = {};
  state.transferHistoryExpandedProcessId = "";
  state.transferHistoryLoadingProcessId = "";
  resetTransitionFlow();
}

function handleUnauthorized(message) {
  clearAuthenticatedState();
  state.authMode = "login";
  state.success = "";
  state.error = message || "Session expired. Please login again.";
}

function parseCapacityInput(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return { error: "Capacity must be a valid number" };
  }
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(raw)) {
    return { error: "Capacity can have at most 2 decimal places" };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { error: "Capacity must be a valid number" };
  }
  if (value <= 0) {
    return { error: "Capacity must be greater than 0" };
  }
  return { normalized: value.toFixed(2) };
}

function normalizeItemTypeClient(value) {
  const raw = String(value || "CONTAINER").trim().toUpperCase();
  if (raw === "CYLENDER") {
    return "CYLINDER";
  }
  return raw;
}

function normalizeVolumeUnitClient(value) {
  return String(value || "").trim().toUpperCase();
}

function applyItemTypeFields(form, labels) {
  const typeSelect = form.querySelector('select[name="item_type"]');
  const capacityText = form.querySelector("[data-capacity-text]");
  const volumeUnitField = form.querySelector("[data-volume-unit-field]");
  const volumeUnitSelect = form.querySelector('select[name="volume_unit"]');
  if (!typeSelect || !capacityText || !volumeUnitField || !volumeUnitSelect) {
    return () => {};
  }

  const sync = () => {
    const itemType = normalizeItemTypeClient(typeSelect.value);
    if (itemType === "CONTAINER") {
      capacityText.textContent = labels.sizeCapacity || labels.capacity;
    } else if (itemType === "CYLINDER") {
      capacityText.textContent = labels.volumeCapacity || labels.capacity;
    } else {
      capacityText.textContent = labels.capacity;
    }

    const isCylinder = itemType === "CYLINDER";
    volumeUnitField.style.display = isCylinder ? "" : "none";
    volumeUnitSelect.required = isCylinder;
    if (!isCylinder) {
      volumeUnitSelect.value = "";
    } else if (!volumeUnitSelect.value) {
      volumeUnitSelect.value = getCylinderVolumeUnits()[0] || "LITERS";
    }
  };

  typeSelect.addEventListener("change", sync);
  sync();
  return sync;
}

function formatFileSize(sizeBytes) {
  const size = Number(sizeBytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function bindFormAction(form, handler) {
  if (!form) {
    return;
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    resetFeedback();
    try {
      await handler(new FormData(form), event);
      if (!state.error) {
        handleSuccessfulFormSubmission(form);
      }
    } catch (error) {
      renderWithError(error.message);
    }
  });
}

function bindClickAction(element, handler) {
  if (!element) {
    return;
  }
  element.addEventListener("click", async (event) => {
    const scrollY = getScrollY();
    resetFeedback();
    try {
      await handler(event);
    } catch (error) {
      renderWithError(error.message);
    } finally {
      restoreScrollY(scrollY);
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function panel(title, subtitle = "", content = "") {
  return `
    <section class="panel">
      <h2>${escapeHtml(title)}</h2>
      ${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ""}
      ${content}
    </section>
  `;
}

function mapViewTitle() {
  const menu = state.labels.menu;
  const dictionary = {
    "items-list": menu.itemsList,
    "users-list": menu.usersList,
    "item-create": menu.itemCreate,
    "item-update": menu.itemUpdate,
    "company-setup": menu.companySetup,
    "user-create": menu.userCreate,
    "user-update": menu.userUpdate,
    "role-update": menu.roleUpdate,
    analytics: menu.analytics,
    "login-controls": menu.loginControls,
    transition: menu.transition,
    profile: menu.profile,
    "admin-password-reset": menu.adminPasswordReset,
    backups: menu.backups,
    orders: menu.orders,
    notifications: menu.notifications,
    "super-admin": menu.superAdmin,
    sessions: menu.sessions,
    logs: menu.logs
  };
  return dictionary[state.view] || state.view;
}

function canAccessTransition() {
  return !!state.user;
}

function canAccessAnalytics() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canAccessLoginControls() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canAccessAdminPages() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canAccessBackups() {
  return canAccessAdminPages();
}

function canManageRequirements() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canManageOrders() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN", "CUSTOMER", "FILLER", "DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(state.user.role);
}

function canCreateItems() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canManageCompanySetup() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canUpdateItems() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canCreateOrders() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN", "CUSTOMER", "FILLER"].includes(state.user.role);
}

function canApproveOrders() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
}

function canDeliverOrders() {
  return !!state.user && ["SUPER_ADMIN", "ADMIN", "DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(state.user.role);
}

const ITEM_STATUSES = ["WITH_ME", "WITH_CLIENT", "IN_SHOP", "IN_FACTORY", "IN_TRANSIT", "LOST", "DAMAGED", "ARCHIVED"];
const ITEM_STATUS_SET = new Set(ITEM_STATUSES);
const ITEM_TYPES = ["CONTAINER", "CYLINDER", "OTHER"];
const ITEM_TYPE_SET = new Set(ITEM_TYPES);
const DEFAULT_CYLINDER_VOLUME_UNITS = ["LITERS", "CUBIC_METERS", "MILLILITERS"];
const FILL_STATES = ["EMPTY", "FULL"];
const FILL_STATE_SET = new Set(FILL_STATES);
const ITEM_CUSTOM_ID_REGEX = /^[A-Z0-9_-]+$/;

const DEFAULT_ITEM_CATEGORY_PRESETS = [
  "2ft x 2ft Box",
  "3ft x 3ft Box",
  "Container",
  "Cylinder",
  "Electronics",
  "Tools",
  "Chemical",
  "Spare Parts"
];

const CATEGORY_CUSTOM_VALUE = "__CUSTOM__";

function getCategoryPresetValues() {
  const managed = (state.itemCategories || [])
    .filter((entry) => entry && entry.is_active)
    .map((entry) => String(entry.category_name || "").trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  if (managed.length > 0) {
    return managed;
  }
  const configured = state.labels?.itemCategories?.presets;
  if (!Array.isArray(configured)) {
    return DEFAULT_ITEM_CATEGORY_PRESETS;
  }
  const values = configured
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : DEFAULT_ITEM_CATEGORY_PRESETS;
}

function renderCategorySelectOptions(selectedValue = "", options = {}) {
  const selected = String(selectedValue || "").trim();
  const presets = getCategoryPresetValues();
  const includeCustom = options.includeCustom !== false;
  const hasPreset = presets.includes(selected);
  const resolved = selected && !hasPreset ? CATEGORY_CUSTOM_VALUE : selected;
  const presetValues = !hasPreset && selected ? [...presets, selected] : presets;
  const presetOptions = presetValues
    .map((value) => `<option value="${escapeHtml(value)}" ${resolved === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
  if (!includeCustom) {
    return presetOptions;
  }
  return `${presetOptions}<option value="${CATEGORY_CUSTOM_VALUE}" ${resolved === CATEGORY_CUSTOM_VALUE ? "selected" : ""}>Custom...</option>`;
}

function getCategoryItemTypes() {
  const activeItemTypes = (state.itemCategories || [])
    .filter((entry) => entry && entry.is_active)
    .map((entry) => String(entry.item_type || "").trim().toUpperCase())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  if (activeItemTypes.length > 0) {
    return activeItemTypes;
  }
  return (state.itemCategories || [])
    .map((entry) => String(entry.item_type || "").trim().toUpperCase())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

function getCategoryNamesForItemType(itemType) {
  const normalizedType = String(itemType || "").trim().toUpperCase();
  const activeNames = (state.itemCategories || [])
    .filter((entry) => entry && entry.is_active && (!normalizedType || String(entry.item_type || "").trim().toUpperCase() === normalizedType))
    .map((entry) => String(entry.category_name || "").trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
  if (activeNames.length > 0) {
    return activeNames;
  }
  if (normalizedType) {
    return [normalizedType];
  }
  return [];
}

function renderCategoryNameOptions(selectedValue = "", itemType = "") {
  const selected = String(selectedValue || "").trim();
  const names = getCategoryNamesForItemType(itemType);
  const hasPreset = names.includes(selected);
  const resolved = selected && !hasPreset ? CATEGORY_CUSTOM_VALUE : selected;
  const values = !hasPreset && selected ? [...names, selected] : names;
  return values
    .map((value) => `<option value="${escapeHtml(value)}" ${resolved === value ? "selected" : ""}>${escapeHtml(value)}</option>`)
    .join("");
}

function renderItemTypeOptions(selectedType = "CONTAINER") {
  const selected = normalizeItemTypeClient(selectedType);
  return ITEM_TYPES.map((itemType) => `<option value="${itemType}" ${selected === itemType ? "selected" : ""}>${itemType}</option>`).join("");
}

function getCylinderVolumeUnits() {
  const values = (state.volumeUnits || [])
    .map((value) => normalizeVolumeUnitClient(value))
    .filter((value, index, arr) => value && arr.indexOf(value) === index);
  return values.length > 0 ? values : DEFAULT_CYLINDER_VOLUME_UNITS;
}

function getCylinderVolumeUnitSet() {
  return new Set(getCylinderVolumeUnits());
}

function renderVolumeUnitOptions(selectedUnit = "") {
  const selected = normalizeVolumeUnitClient(selectedUnit);
  return [`<option value="">-</option>`, ...getCylinderVolumeUnits().map((unit) => `<option value="${unit}" ${selected === unit ? "selected" : ""}>${unit}</option>`)]
    .join("");
}

function formatVolumeUnitSuffix(unitValue) {
  const unit = normalizeVolumeUnitClient(unitValue);
  if (!unit) {
    return "";
  }
  if (unit === "CUBIC_METERS") {
    return " m3";
  }
  if (unit === "LITERS") {
    return " L";
  }
  if (unit === "MILLILITERS") {
    return " mL";
  }
  return ` ${unit}`;
}

function getAllowedNextStatuses(currentStatus) {
  const normalized = String(currentStatus || "").toUpperCase();
  const transitions = state.itemStatusPolicy?.transitions?.[normalized] || [];
  return [normalized, ...transitions].filter((value, index, arr) => value && arr.indexOf(value) === index);
}

function formatItemStatusLabel(status) {
  const value = String(status || "").toUpperCase();
  if (value === "WITH_ME") {
    return state.labels?.items?.withMeLabel || "At Company Location";
  }
  if (value === "WITH_CLIENT") {
    return state.labels?.items?.withClientLabel || "Customer";
  }
  return value;
}

function normalizeFillState(value) {
  return String(value || "").toUpperCase() === "FULL" ? "FULL" : "EMPTY";
}

function normalizeCustomIdInput(value, options = {}) {
  const required = options.required === true;
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) {
    return { value: "", error: required ? "Custom ID is required" : "" };
  }
  if (normalized.length < 2 || normalized.length > 50) {
    return { value: "", error: "Custom ID must be between 2 and 50 characters" };
  }
  if (!ITEM_CUSTOM_ID_REGEX.test(normalized)) {
    return { value: "", error: "Custom ID can contain only A-Z, 0-9, dash, and underscore" };
  }
  return { value: normalized, error: "" };
}

function getTransitionDefaultFillStateBySource() {
  const action = String(state.transitionFlow?.action || "").trim().toUpperCase();
  const sourceType = String(state.transitionFlow?.sourceType || "").trim().toUpperCase();
  if (action !== "TAKING") {
    return "";
  }
  if (sourceType === "EMPLOYEE" || sourceType === "FILLER") {
    return "FULL";
  }
  if (sourceType === "CUSTOMER") {
    return "EMPTY";
  }
  return "";
}

function normalizeUserRoleValue(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (normalized === "EXTERNALPARTNER") {
    return "EXTERNAL_PARTNER";
  }
  if (normalized === "DELIVERYPARTNER") {
    return "DELIVERY_PARTNER";
  }
  if (normalized === "USER" || normalized === "CUSTOMER") {
    return "CUSTOMER";
  }
  if (normalized === "MANAGER" || normalized === "AUDITOR") {
    return "ADMIN";
  }
  return normalized;
}

function getFillStateClassName(value) {
  return normalizeFillState(value) === "FULL" ? "state-full" : "state-empty";
}

function renderFillStateBadge(value) {
  const normalized = normalizeFillState(value);
  return `<span class="state-badge ${getFillStateClassName(normalized)}">${escapeHtml(normalized)}</span>`;
}

function renderFillStateRadioGroup(fieldName, selectedValue = "EMPTY") {
  const selected = normalizeFillState(selectedValue);
  return `
    <div class="transition-action-group" role="radiogroup" aria-label="Fill State">
      <label class="transition-action-option ${selected === "FULL" ? "active" : ""}">
        <input type="radio" name="${escapeHtml(fieldName)}" value="FULL" ${selected === "FULL" ? "checked" : ""} />
        <span>FULL</span>
      </label>
      <label class="transition-action-option ${selected === "EMPTY" ? "active" : ""}">
        <input type="radio" name="${escapeHtml(fieldName)}" value="EMPTY" ${selected === "EMPTY" ? "checked" : ""} />
        <span>EMPTY</span>
      </label>
    </div>
  `;
}

function setFillStateFieldValue(form, fieldName, value) {
  if (!form) {
    return;
  }
  const normalized = normalizeFillState(value);
  const radios = form.querySelectorAll(`input[type="radio"][name="${fieldName}"]`);
  if (radios.length > 0) {
    radios.forEach((radio) => {
      const radioValue = normalizeFillState(radio.value);
      radio.checked = radioValue === normalized;
      const option = radio.closest(".transition-action-option");
      if (option) {
        option.classList.toggle("active", radio.checked);
      }
    });
    return;
  }
  const select = form.querySelector(`select[name="${fieldName}"]`);
  if (select) {
    select.value = normalized;
    syncFillStateFieldAppearance(select);
  }
}

function syncFillStateFieldAppearance(select) {
  if (!select) {
    return;
  }
  select.classList.remove("state-full", "state-empty");
  select.classList.add(getFillStateClassName(select.value));
}

function renderAllStatusOptions(selectedStatus = "WITH_ME") {
  const selected = String(selectedStatus || "WITH_ME").toUpperCase();
  return ITEM_STATUSES.map((status) => `<option value="${status}" ${selected === status ? "selected" : ""}>${escapeHtml(formatItemStatusLabel(status))}</option>`).join("");
}

function renderStatusOptionsForItem(currentStatus, selectedStatus) {
  const allowed = new Set(getAllowedNextStatuses(currentStatus));
  const selected = String(selectedStatus || currentStatus || "WITH_ME").toUpperCase();
  const sequence = Array.isArray(state.itemStatusPolicy?.sequence) ? state.itemStatusPolicy.sequence : [];
  return sequence.filter((status) => allowed.has(status))
    .map((status) => `<option value="${status}" ${selected === status ? "selected" : ""}>${escapeHtml(formatItemStatusLabel(status))}</option>`)
    .join("");
}

function renderCompanyOptions(selectedCompanyId = "", options = {}) {
  const selected = String(selectedCompanyId || "").trim();
  const includeBlank = options.includeBlank !== false;
  const blankLabel = options.blankLabel || "Select Company";
  const activeOnly = options.activeOnly !== false;
  const rows = (state.companies || []).filter((company) => !activeOnly || !!company.is_active);
  const optionRows = rows
    .map((company) => `<option value="${escapeHtml(company.id)}" ${selected === company.id ? "selected" : ""}>${escapeHtml(company.company_name || "-")}</option>`)
    .join("");
  if (!includeBlank) {
    return optionRows;
  }
  return `<option value="">${escapeHtml(blankLabel)}</option>${optionRows}`;
}

function renderLocationOptions(selectedLocationId = "", companyId = "", options = {}) {
  const selected = String(selectedLocationId || "").trim();
  const company = String(companyId || "").trim();
  const includeBlank = options.includeBlank !== false;
  const blankLabel = options.blankLabel || "Select Location";
  const activeOnly = options.activeOnly !== false;
  const rows = (state.companyLocations || []).filter((location) => {
    if (activeOnly && !location.is_active) {
      return false;
    }
    if (company) {
      return String(location.company_id || "") === company;
    }
    return true;
  });
  const optionRows = rows
    .map((location) => `<option value="${escapeHtml(location.id)}" ${selected === location.id ? "selected" : ""}>${escapeHtml(location.location_name || "-")}</option>`)
    .join("");
  if (!includeBlank) {
    return optionRows;
  }
  return `<option value="">${escapeHtml(blankLabel)}</option>${optionRows}`;
}

function getFallbackCompanyLocationName() {
  const activeCompany = (state.companies || []).find((company) => !!company?.is_active);
  if (activeCompany) {
    return String(activeCompany.company_name || "").trim();
  }
  const firstCompany = (state.companies || [])[0] || null;
  return String(firstCompany?.company_name || "").trim();
}

function renderExternalPartnerOwnerOptions(selectedOwnerName = "", options = {}) {
  const selected = String(selectedOwnerName || "").trim();
  const blankLabel = options.blankLabel || "Select External Partner";
  const activeOnly = options.activeOnly !== false;
  const partners = (state.users || []).filter((user) => {
    const role = String(user.role || "").trim().toUpperCase();
    if (role !== "EXTERNAL_PARTNER") {
      return false;
    }
    if (activeOnly && user.is_active === false) {
      return false;
    }
    return true;
  });
  const seen = new Set();
  const optionRows = [];

  if (selected) {
    seen.add(selected.toLowerCase());
    optionRows.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`);
  }

  partners.forEach((partner) => {
    const ownerValue = String(partner.full_name || partner.email || partner.user_code || "").trim();
    if (!ownerValue) {
      return;
    }
    const dedupeKey = ownerValue.toLowerCase();
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    const optionLabel = `${partner.user_code || "----"} - ${partner.full_name || partner.email || ownerValue}`;
    optionRows.push(`<option value="${escapeHtml(ownerValue)}">${escapeHtml(optionLabel)}</option>`);
  });

  return `<option value="">${escapeHtml(blankLabel)}</option>${optionRows.join("")}`;
}

function getAllowedViews() {
  const allowed = new Set(["items-list", "profile", "orders", "notifications", "sessions"]);

  if (state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role)) {
    allowed.add("users-list");
  }
  if (canCreateItems()) {
    allowed.add("item-create");
    allowed.add("item-update");
  }
  if (canManageRequirements()) {
    allowed.add("user-create");
    allowed.add("user-update");
    allowed.add("role-update");
  }
  if (canManageCompanySetup()) {
    allowed.add("company-setup");
  }
  if (canAccessAnalytics()) {
    allowed.add("analytics");
  }
  if (canAccessLoginControls()) {
    allowed.add("login-controls");
  }
  if (canAccessTransition()) {
    allowed.add("transition");
    allowed.add("transfer-history");
  }
  if (canAccessAdminPages()) {
    if (state.user?.role === "ADMIN") {
      allowed.add("admin-password-reset");
    }
    allowed.add("backups");
  }
  if (canAccessSuperAdminPage()) {
    allowed.add("super-admin");
  }
  if (state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role)) {
    allowed.add("logs");
    allowed.add("activity");
  }

  return allowed;
}

function getNavigationGroups(allowedViews, labels) {
  const groups = [
    {
      key: "items",
      label: labels.menu.itemsGroup || labels.menu.itemsList || "Items",
      views: ["items-list", "item-create", "item-update"],
      defaultView: "items-list"
    },
    {
      key: "users",
      label: labels.menu.usersGroup || labels.menu.usersList || "Users",
      views: ["users-list", "user-create", "user-update", "role-update", "login-controls"],
      defaultView: "users-list"
    },
    {
      key: "operations",
      label: labels.menu.workflowGroup || "Workflow",
      views: ["transition", "transfer-history", "orders", "notifications"],
      defaultView: "transition"
    },
    {
      key: "admin",
      label: labels.menu.adminGroup || "Admin",
      views: ["company-setup", "analytics", "backups", "super-admin"],
      defaultView: "analytics"
    },
    {
      key: "system",
      label: labels.menu.systemGroup || "System",
      views: ["sessions", "activity", "logs"],
      defaultView: "sessions"
    }
  ];

  return groups
    .map((group) => ({ ...group, views: group.views.filter((viewKey) => allowedViews.has(viewKey)) }))
    .filter((group) => group.views.length > 0);
}

function getActiveNavigationGroup(groups) {
  const currentGroupKey = String(state.navGroup || "").trim();
  const explicit = groups.find((group) => group.key === currentGroupKey);
  if (explicit) {
    return explicit;
  }
  const byCurrentView = groups.find((group) => group.views.includes(state.view));
  if (byCurrentView) {
    return byCurrentView;
  }
  return groups[0] || null;
}

function ensureAllowedView() {
  const allowed = getAllowedViews();
  if (!allowed.has(state.view)) {
    state.view = "items-list";
  }
}

function isSuperAdmin() {
  return !!state.user && state.user.role === "SUPER_ADMIN";
}

function canAccessSuperAdminPage() {
  return isSuperAdmin();
}

function readSecurityKeys(formData, prefix = "") {
  return {
    key1: String(formData.get(`${prefix}security_key_1`) || "").trim(),
    key2: String(formData.get(`${prefix}security_key_2`) || "").trim(),
    key3: String(formData.get(`${prefix}security_key_3`) || "").trim()
  };
}

function validateSecurityKeysInput(keys) {
  const values = [keys.key1, keys.key2, keys.key3];
  const providedCount = values.filter((value) => value.length > 0).length;
  if (providedCount !== 0 && providedCount !== 3) {
    return "Provide all 3 security keys or leave all empty";
  }
  if (providedCount === 3 && values.some((value) => value.length < 3 || value.length > 120)) {
    return "Each security key must be between 3 and 120 characters";
  }
  return "";
}

function validateSecurityKeysRequired(keys) {
  const baseError = validateSecurityKeysInput(keys);
  if (baseError) {
    return baseError;
  }
  if (!keys.key1 || !keys.key2 || !keys.key3) {
    return "All 3 security keys are required";
  }
  return "";
}

function evaluatePasswordStrength(password) {
  const value = String(password || "");
  if (!value) {
    return { label: "", score: 0 };
  }
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (value.length >= 12) score += 1;

  if (score <= 2) return { label: "Weak", score };
  if (score <= 4) return { label: "Medium", score };
  return { label: "Strong", score };
}

function attachPasswordStrengthMeters() {
  document.querySelectorAll("[data-strength-input]").forEach((input) => {
    const meterId = input.getAttribute("data-strength-input");
    const meter = document.querySelector(`[data-strength-meter='${meterId}']`);
    if (!meter) {
      return;
    }
    const refresh = () => {
      const { label } = evaluatePasswordStrength(input.value || "");
      meter.textContent = label ? `Password strength: ${label}` : "Password strength:";
      meter.setAttribute("data-strength-level", label.toLowerCase());
    };
    input.addEventListener("input", refresh);
    refresh();
  });
}

function attachPasswordFieldTools() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = String(button.getAttribute("data-password-toggle") || "");
      const input = document.getElementById(targetId);
      if (!input) {
        return;
      }
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    });
  });

  document.querySelectorAll("[data-password-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = String(button.getAttribute("data-password-copy") || "");
      const input = document.getElementById(targetId);
      if (!input) {
        return;
      }
      const value = String(input.value || "");
      if (!value) {
        state.error = "Nothing to copy";
        state.success = "";
        render();
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        state.success = "Success";
        state.error = "";
        render();
      } catch {
        state.error = "Copy failed";
        state.success = "";
        render();
      }
    });
  });
}

function loginView() {
  const labels = state.labels;
  if (state.authMode === "register") {
    const form = `
      <form id="register-form" class="grid">
        <label>${escapeHtml(labels.registration.fullName)}<input name="full_name" required minlength="2" maxlength="120" /></label>
        <label>${escapeHtml(labels.login.email)}<input name="email" type="email" required /></label>
        <label>${escapeHtml(labels.login.password)}<input name="password" type="password" required data-strength-input="register-password" /></label>
        <p class="muted" data-strength-meter="register-password">Password strength:</p>
        <label>${escapeHtml(labels.registration.securityKey1 || labels.login.securityKey1)}<input name="security_key_1" type="password" minlength="3" maxlength="120" /></label>
        <label>${escapeHtml(labels.registration.securityKey2 || labels.login.securityKey2)}<input name="security_key_2" type="password" minlength="3" maxlength="120" /></label>
        <label>${escapeHtml(labels.registration.securityKey3 || labels.login.securityKey3)}<input name="security_key_3" type="password" minlength="3" maxlength="120" /></label>
        <button type="submit">${escapeHtml(labels.registration.selfRegister)}</button>
      </form>
      <div class="row">
        <button id="switch-auth" type="button">${escapeHtml(labels.registration.goLogin)}</button>
      </div>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    `;
    app.innerHTML = `<div class="login-container">${panel(labels.registration.selfTitle, labels.registration.selfSubtitle, form)}</div>${renderSuccessModal()}`;
      restoreCurrentFormDrafts();
    attachGlobalSuccessModal();
    const formEl = document.getElementById("register-form");
    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(formEl);
      const securityKeys = readSecurityKeys(formData);
      const securityError = validateSecurityKeysInput(securityKeys);
      if (securityError) {
        state.error = securityError;
        state.success = "";
        render();
        return;
      }
      try {
        await api("/api/users/register-self", {
          method: "POST",
          body: JSON.stringify({
            full_name: formData.get("full_name"),
            email: formData.get("email"),
            password: formData.get("password"),
            security_key_1: securityKeys.key1,
            security_key_2: securityKeys.key2,
            security_key_3: securityKeys.key3
          })
        });
        state.authMode = "login";
        state.success = "Success";
        render();
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
    document.getElementById("switch-auth").addEventListener("click", () => {
      state.authMode = "login";
      state.error = "";
      state.success = "";
      render();
    });
    return;
  }

  if (state.authMode === "forgot") {
    const form = `
      <form id="forgot-password-form" class="grid">
        <label>${escapeHtml(labels.forgotPassword.email)}<input name="email" type="email" required /></label>
        <label>${escapeHtml(labels.forgotPassword.securityKey1)}<input name="security_key_1" type="password" required minlength="3" maxlength="120" /></label>
        <label>${escapeHtml(labels.forgotPassword.securityKey2)}<input name="security_key_2" type="password" required minlength="3" maxlength="120" /></label>
        <label>${escapeHtml(labels.forgotPassword.securityKey3)}<input name="security_key_3" type="password" required minlength="3" maxlength="120" /></label>
        <label>${escapeHtml(labels.forgotPassword.newPassword)}<input name="new_password" type="password" required minlength="8" maxlength="128" data-strength-input="forgot-password" /></label>
        <p class="muted" data-strength-meter="forgot-password">Password strength:</p>
        <label>${escapeHtml(labels.forgotPassword.confirmPassword)}<input name="confirm_password" type="password" required minlength="8" maxlength="128" /></label>
        <button type="submit">${escapeHtml(labels.forgotPassword.submit)}</button>
      </form>
      <div class="row">
        <button id="back-to-login" type="button">${escapeHtml(labels.forgotPassword.back)}</button>
      </div>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    `;

    app.innerHTML = `<div class="login-container">${panel(labels.forgotPassword.sectionTitle, labels.forgotPassword.sectionSubtitle, form)}</div>${renderSuccessModal()}`;
      restoreCurrentFormDrafts();
    attachGlobalSuccessModal();
    const forgotForm = document.getElementById("forgot-password-form");
    forgotForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(forgotForm);
      const securityKeys = readSecurityKeys(formData);
      const securityError = validateSecurityKeysRequired(securityKeys);
      if (securityError) {
        state.error = securityError;
        render();
        return;
      }
      const newPassword = String(formData.get("new_password") || "");
      const confirmPassword = String(formData.get("confirm_password") || "");
      if (newPassword !== confirmPassword) {
        state.error = "New password and confirm password must match";
        render();
        return;
      }
      try {
        await api("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({
            email: String(formData.get("email") || "").trim(),
            security_key_1: securityKeys.key1,
            security_key_2: securityKeys.key2,
            security_key_3: securityKeys.key3,
            new_password: newPassword,
            confirm_password: confirmPassword
          })
        });
        state.authMode = "login";
        state.success = "Success";
        state.error = "";
        render();
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });

    document.getElementById("back-to-login").addEventListener("click", () => {
      state.authMode = "login";
      state.error = "";
      state.success = "";
      render();
    });
    return;
  }

  const form = `
    <form id="login-form" class="grid login-form">
      <label>${escapeHtml(labels.login.email)}<input name="email" type="email" required /></label>
      <label>${escapeHtml(labels.login.password)}<input name="password" type="password" required /></label>
      <label>${escapeHtml(labels.login.systemMac)}<input name="system_mac" placeholder="AA:BB:CC:DD:EE:FF" /></label>
      <label>${escapeHtml(labels.login.adminCode)}<input name="admin_code" /></label>
      <button type="submit">${escapeHtml(labels.login.submit)}</button>
    </form>
    <div class="row auth-actions">
      <button id="switch-auth" type="button">${escapeHtml(labels.registration.goSelfRegister)}</button>
      <button id="forgot-auth" type="button">${escapeHtml(labels.login.forgotPassword)}</button>
    </div>
    ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
  `;

  app.innerHTML = `<div class="login-container">${panel(labels.app.title, labels.app.subtitle, form)}</div>${renderSuccessModal()}`;
    restoreCurrentFormDrafts();
  attachGlobalSuccessModal();
  const formEl = document.getElementById("login-form");
  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.error = "";
    state.success = "";
    const formData = new FormData(formEl);
    const loginPayload = {
      email: formData.get("email"),
      password: formData.get("password"),
      system_mac: formData.get("system_mac"),
      admin_code: formData.get("admin_code")
    };
    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginPayload)
      });
      state.user = result.user;
      state.csrfToken = String(result.csrf_token || "");
      await hydrateDashboard();
      state.success = "Success";
      render();
    } catch (error) {
      state.error = error.message;
      state.success = "";
      render();
    }
  });

  document.getElementById("switch-auth").addEventListener("click", () => {
    state.authMode = "register";
    state.error = "";
    state.success = "";
    render();
  });

  document.getElementById("forgot-auth").addEventListener("click", () => {
    state.authMode = "forgot";
    state.error = "";
    state.success = "";
    render();
  });
}

function navView() {
  const labels = state.labels;
  const allowedViews = getAllowedViews();
  const profileAllowed = allowedViews.has("profile");
  const navGroups = getNavigationGroups(allowedViews, labels);
  const activeGroup = getActiveNavigationGroup(navGroups);
  const viewLabels = {
    "items-list": labels.menu.itemsListSub || "List Items",
    "item-create": labels.menu.itemCreate,
    "item-update": labels.menu.itemUpdate,
    "users-list": labels.menu.usersListSub || "User Directory",
    "user-create": labels.menu.userCreate,
    "user-update": labels.menu.userUpdate,
    "role-update": labels.menu.roleUpdate,
    "login-controls": labels.menu.loginControlsSub || labels.menu.loginControls,
    transition: labels.menu.transitionSub || labels.menu.transition,
    "transfer-history": labels.menu.transferHistorySub || labels.menu.transferHistory || "Transfer History",
    orders: labels.menu.ordersSub || labels.menu.orders,
    notifications: labels.menu.notificationsSub || labels.menu.notifications,
    analytics: labels.menu.analyticsSub || labels.menu.analytics,
    backups: labels.menu.backupsSub || labels.menu.backups,
    "super-admin": labels.menu.superAdminSub || labels.menu.superAdmin,
    sessions: labels.menu.sessionsSub || labels.menu.sessions,
    activity: labels.menu.activitySub || labels.menu.activity || "Activity Log",
    logs: labels.menu.logsSub || labels.menu.logs
  };

  return `
    <nav class="nav-bar">
      <div class="nav" id="nav-menu">
        <div class="nav-groups">
        ${navGroups
          .map(
            (group) =>
              `<button data-nav-group="${group.key}" class="${activeGroup?.key === group.key ? "active" : ""}">${escapeHtml(group.label)}</button>`
          )
          .join("")}
        </div>
        <div class="nav-sub">
        ${(activeGroup?.views || [])
          .map(
            (viewKey) =>
              `<button data-view="${viewKey}" class="${state.view === viewKey ? "active" : ""}">${escapeHtml(viewLabels[viewKey] || viewKey)}</button>`
          )
          .join("")}
        </div>
      </div>
      <div class="nav-actions">
        <button class="menu-toggle" id="menu-toggle" aria-label="Toggle menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>
        ${
          profileAllowed
            ? `<button data-view="profile" class="${state.view === "profile" ? "active" : ""}">${escapeHtml(labels.menu.profile)}</button>`
            : ""
        }
        <button id="logout-btn">${escapeHtml(labels.login.logout)}</button>
      </div>
    </nav>
  `;
}

function itemsListView() {
  const labels = state.labels.items;
  const searchFilter = String(state.itemSearchFilter || "").trim().toLowerCase();
  const statusFilter = String(state.itemStatusFilter || "").trim().toUpperCase();
  const categoryFilter = String(state.itemCategoryFilter || "").trim().toLowerCase();
  const userFilter = String(state.itemUserFilter || "").trim().toLowerCase();
  const defaultCompanyName = String(
    (state.companies || []).find((company) => company?.is_active !== false)?.company_name
    || (state.companies || [])[0]?.company_name
    || ""
  ).trim();
  const resolveDisplayOwnerName = (item) => {
    const ownershipType = String(item?.ownership_type || "OURS").trim().toUpperCase();
    if (ownershipType === "EXTERNAL") {
      return String(item?.owner_name || "").trim() || "-";
    }
    return String(item?.location_company_name || "").trim() || defaultCompanyName || "-";
  };
  const resolveDisplayStatusName = (item) => {
    const normalizedStatus = String(item?.status || "").trim().toUpperCase();
    if (normalizedStatus === "WITH_ME") {
      return String(item?.location_company_name || "").trim() || defaultCompanyName || formatItemStatusLabel(normalizedStatus);
    }
    if (normalizedStatus === "WITH_CLIENT") {
      return String(item?.current_location || "").trim() || (state.labels?.items?.withClientLabel || "Customer");
    }
    return formatItemStatusLabel(normalizedStatus || item?.status || "-");
  };
  const resolveStatusFilterOptionLabel = (statusValue) => {
    const normalizedStatus = String(statusValue || "").trim().toUpperCase();
    if (normalizedStatus === "WITH_ME") {
      return defaultCompanyName || formatItemStatusLabel(normalizedStatus);
    }
    if (normalizedStatus === "WITH_CLIENT") {
      return state.labels?.items?.withClientLabel || "Customer";
    }
    return formatItemStatusLabel(normalizedStatus || statusValue || "-");
  };
  const statusOptions = Array.from(new Set((state.items || []).map((item) => String(item.status || "").trim()).filter(Boolean))).sort();
  const categoryOptions = Array.from(new Set((state.items || []).map((item) => String(item.category || "").trim()).filter(Boolean))).sort();
  const userOptions = Array.from(new Set((state.items || []).map((item) => String(item.created_by_name || "").trim()).filter(Boolean))).sort();
  const filteredItems = (state.items || []).filter((item) => {
    if (statusFilter && String(item.status || "").trim().toUpperCase() !== statusFilter) {
      return false;
    }
    if (categoryFilter && String(item.category || "").trim().toLowerCase() !== categoryFilter) {
      return false;
    }
    if (userFilter && !String(item.created_by_name || "").trim().toLowerCase().includes(userFilter)) {
      return false;
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [
      item.item_code,
      item.custom_id,
      item.title,
      item.category,
      item.ownership_type,
      resolveDisplayOwnerName(item),
      resolveDisplayStatusName(item),
      item.current_location,
      item.created_by_name,
      item.created_by_mode
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });

  return `
    <div class="task-box items-list-shell">
    <div class="row items-list-filters" style="margin-bottom:var(--sp-2)">
      <label style="max-width:320px">Search
        <input id="items-search-filter" type="text" value="${escapeHtml(state.itemSearchFilter || "")}" placeholder="Code, custom ID, title, category, status" />
      </label>
      <label style="max-width:220px">Status
        <select id="items-status-filter">
          <option value="">All</option>
          ${statusOptions.map((status) => `<option value="${escapeHtml(status)}" ${statusFilter === status.toUpperCase() ? "selected" : ""}>${escapeHtml(resolveStatusFilterOptionLabel(status))}</option>`).join("")}
        </select>
      </label>
      <label style="max-width:260px">Category
        <select id="items-category-filter">
          <option value="">All</option>
          ${categoryOptions.map((category) => `<option value="${escapeHtml(category)}" ${categoryFilter === category.toLowerCase() ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
        </select>
      </label>
      <label style="max-width:260px">${escapeHtml(labels.createdBy || "User")}
        <input id="items-user-filter" list="items-user-filter-options" value="${escapeHtml(state.itemUserFilter || "")}" placeholder="All" />
        <datalist id="items-user-filter-options">
          ${userOptions.map((userName) => `<option value="${escapeHtml(userName)}"></option>`).join("")}
        </datalist>
      </label>
    </div>
    <div class="table-wrap items-list-content">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(labels.code)}</th>
            <th>${escapeHtml(labels.customId || "Custom ID")}</th>
            <th>${escapeHtml(labels.title)}</th>
            <th>${escapeHtml(labels.status)}</th>
            <th>${escapeHtml(labels.location)}</th>
            <th>${escapeHtml(labels.itemState)}</th>
            <th>${escapeHtml(labels.capacity)}</th>
            <th>${escapeHtml(labels.more || "More")}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredItems
            .map(
              (item) => `
                <tr>
                  <td>${escapeHtml(item.item_code)}</td>
                  <td>${escapeHtml(item.custom_id || "-")}</td>
                  <td>${escapeHtml(item.title)}</td>
                  <td>${escapeHtml(resolveDisplayStatusName(item))}</td>
                  <td>${escapeHtml(item.current_location || "-")}</td>
                  <td>${renderFillStateBadge(item.fill_state)}</td>
                  <td>${escapeHtml(`${item.capacity ?? "-"}${item.item_type === "CYLINDER" ? formatVolumeUnitSuffix(item.volume_unit) : ""}`)}</td>
                  <td>
                    <details>
                      <summary>${escapeHtml(labels.more || "More")}</summary>
                      <div class="muted" style="margin-top:6px;line-height:1.5">
                        <div>${escapeHtml(labels.category || "Category")}: ${escapeHtml(item.category || "-")}</div>
                        <div>${escapeHtml(labels.ownership || "Ownership")}: ${escapeHtml(item.ownership_type === "EXTERNAL" ? (state.labels.itemCreate?.ownershipExternal || "External item") : (state.labels.itemCreate?.ownershipOurs || "Our item"))}</div>
                        <div>${escapeHtml(labels.ownerName || "Owner Name")}: ${escapeHtml(resolveDisplayOwnerName(item))}</div>
                        <div>${escapeHtml(labels.itemType || "Type")}: ${escapeHtml(item.item_type || "-")}</div>
                        <div>${escapeHtml(labels.cycleCount || "Cycles")}: ${escapeHtml(item.cycle_count ?? 0)}</div>
                        <div>${escapeHtml(labels.ageYears || "Age (Years)")}: ${escapeHtml(item.age_years ?? 0)}</div>
                        <div>${escapeHtml(labels.warning || "Warning")}: ${item.warning_active ? escapeHtml(item.warning_reason || "WARNING") : "-"}</div>
                        <div>${escapeHtml(labels.createdBy || "Created By")}: ${escapeHtml(item.created_by_name || "-")}</div>
                        <div>${escapeHtml(labels.createdMode || "Created Mode")}: ${escapeHtml(item.created_by_mode || "-")}</div>
                        <div>${escapeHtml(labels.updated || "Updated")}: ${escapeHtml(item.updated_at || "-")}</div>
                      </div>
                    </details>
                  </td>
                </tr>
              `
            )
            .join("") || `<tr><td colspan="9" class="muted">No matching items</td></tr>`}
        </tbody>
      </table>
    </div>
    </div>
  `;
}

function usersListView() {
  const labels = state.labels.usersList;
  const canSeeUsers = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  if (!canSeeUsers) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }

  const searchFilter = String(state.userSearchFilter || "").trim().toLowerCase();
  const roleFilter = String(state.userRoleFilter || "").trim().toUpperCase();
  const activeFilter = String(state.userActiveFilter || "").trim().toLowerCase();
  const roleOptions = Array.from(new Set((state.users || []).map((user) => String(user.role || "").trim()).filter(Boolean))).sort();
  const filteredUsers = (state.users || []).filter((user) => {
    if (roleFilter && String(user.role || "").trim().toUpperCase() !== roleFilter) {
      return false;
    }
    if (activeFilter) {
      const isActive = !!user.is_active;
      if ((activeFilter === "active" && !isActive) || (activeFilter === "inactive" && isActive)) {
        return false;
      }
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [
      user.user_code,
      user.full_name,
      user.email,
      user.role,
      user.created_by_name
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });

  return `
    <div class="task-box list-scroll-shell">
      <div class="list-scroll-head">
      <div class="row" style="margin-bottom:var(--sp-2)">
        <label style="max-width:320px">Search
          <input id="users-search-filter" type="text" value="${escapeHtml(state.userSearchFilter || "")}" placeholder="Code, name, email, role" />
        </label>
        <label style="max-width:220px">Role
          <select id="users-role-filter">
            <option value="">All</option>
            ${roleOptions.map((role) => `<option value="${escapeHtml(role)}" ${roleFilter === role.toUpperCase() ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}
          </select>
        </label>
        <label style="max-width:200px">Active
          <select id="users-active-filter">
            <option value="">All</option>
            <option value="active" ${activeFilter === "active" ? "selected" : ""}>${escapeHtml(state.labels.common.yes || "Yes")}</option>
            <option value="inactive" ${activeFilter === "inactive" ? "selected" : ""}>${escapeHtml(state.labels.common.no || "No")}</option>
          </select>
        </label>
      </div>
      </div>
      <div class="table-wrap list-scroll-content">
        <table>
          <thead>
            <tr>
              <th>${escapeHtml(labels.userCode)}</th>
              <th>${escapeHtml(labels.fullName)}</th>
              <th>${escapeHtml(labels.email)}</th>
              <th>${escapeHtml(labels.role)}</th>
              <th>${escapeHtml(labels.active)}</th>
              <th>${escapeHtml(labels.createdBy)}</th>
              <th>${escapeHtml(labels.createdMode)}</th>
              <th>${escapeHtml(labels.createdAt)}</th>
            </tr>
          </thead>
          <tbody>
            ${filteredUsers
              .map(
                (user) => `
                  <tr>
                    <td>${escapeHtml(user.user_code || "-")}</td>
                    <td>${escapeHtml(user.full_name || "-")}</td>
                    <td>${escapeHtml(user.email || "-")}</td>
                    <td>${escapeHtml(user.role || "-")}</td>
                    <td>${user.is_active ? escapeHtml(state.labels.common.yes) : escapeHtml(state.labels.common.no)}</td>
                    <td>${escapeHtml(user.created_by_name || "-")}</td>
                    <td>${escapeHtml(user.created_by_mode || "-")}</td>
                    <td>${escapeHtml(user.created_at || "-")}</td>
                  </tr>
                `
              )
              .join("") || `<tr><td colspan="8" class="muted">${escapeHtml(labels.empty)}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function itemCreateView() {
  const labels = state.labels.itemCreate;
  if (!canCreateItems()) {
    return `<p class="muted">${escapeHtml(labels.adminOnly || "Only Admin can create items")}</p>`;
  }
  const hasActiveCompanyLocations = (state.companyLocations || []).some((location) => !!location?.is_active);
  const fallbackCompanyLocationName = getFallbackCompanyLocationName();
  const categoryItemTypes = getCategoryItemTypes();
  const showCategoryTypeSelect = categoryItemTypes.length > 1;
  const locationFallbackHint = !hasActiveCompanyLocations
    ? (labels.locationFallbackHint || (fallbackCompanyLocationName
      ? `No active locations configured. Using company name (${fallbackCompanyLocationName}) as location.`
      : "No active locations configured. Company name will be used as location."))
    : "";
  return `
    <form id="item-create-form" class="grid">
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.basicInfo || "Basic Info")}</p>
      ${showCategoryTypeSelect ? `
      <label>${escapeHtml(labels.categoryType || labels.itemType || "Category Type")}
        <select name="category_type_select" required>
          <option value="">${escapeHtml(labels.selectCategoryType || "Select Category Type")}</option>
          ${categoryItemTypes.map((itemType) => `<option value="${escapeHtml(itemType)}">${escapeHtml(itemType)}</option>`).join("")}
        </select>
      </label>
      ` : `
      <input type="hidden" name="category_type_select" value="${escapeHtml(categoryItemTypes[0] || "")}" />
      `}
      <label>${escapeHtml(labels.category)}
        <select name="category_select" required>
          <option value="">${escapeHtml(labels.selectCategory || "Select Category")}</option>
        </select>
      </label>
      <div id="item-create-prefix-container" style="display:none">
        <label>${escapeHtml(labels.codePrefix || "Code Prefix")}<select id="item-create-prefix-select" name="code_prefix"></select></label>
      </div>
      <label>${escapeHtml(labels.itemId)}<input id="item-create-code-preview" value="${escapeHtml(state.lastGeneratedItemCode || "")}" readonly /></label>
      <label>${escapeHtml(labels.customId || "Custom ID (Optional)")}<input name="custom_id" minlength="2" maxlength="50" placeholder="E.g. BOX_MAIN_01" /></label>
      <p class="muted">${escapeHtml(labels.itemCodeNote)}</p>
      <label>${escapeHtml(labels.title)}<input name="title" required minlength="2" maxlength="200" /></label>
      <label>${escapeHtml(labels.ownership || "Ownership")}
        <select name="ownership_type" required>
          <option value="OURS">${escapeHtml(labels.ownershipOurs || "Self / Company")}</option>
          <option value="EXTERNAL">${escapeHtml(labels.ownershipExternal || "External Partner")}</option>
        </select>
      </label>
      <label data-external-owner-field style="display:none">${escapeHtml(labels.ownerName || "Owner Name (External Partner)")}
        <select name="external_owner_name">
          ${renderExternalPartnerOwnerOptions("", { blankLabel: labels.selectExternalPartner || "Select External Partner" })}
        </select>
      </label>
      <label>${escapeHtml(labels.quantity || "Quantity")}
        <input name="quantity" type="number" required min="1" max="100" step="1" value="1" />
      </label>
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.specifications || "Specifications")}</p>
      <label>${escapeHtml(labels.itemType || "Type")}
        <select name="item_type" required>
          ${renderItemTypeOptions("CONTAINER")}
        </select>
      </label>
      <label><span data-capacity-text>${escapeHtml(labels.sizeCapacity || labels.capacity)}</span><input name="capacity" type="number" required min="0.01" step="0.01" /></label>
      <label data-volume-unit-field style="display:none">${escapeHtml(labels.volumeUnit || "Volume Unit")}
        <select name="volume_unit">
          ${renderVolumeUnitOptions("")}
        </select>
      </label>
      <p class="form-section-title" data-location-section>${escapeHtml(state.labels.formSections?.statusLocation || "Status & Location")}</p>
      <input type="hidden" name="status" value="WITH_ME" />
      <label><span>${escapeHtml(labels.itemState)}</span>
        ${renderFillStateRadioGroup("fill_state", "FULL")}
      </label>
      <label data-location-field>${escapeHtml(labels.locationName || "Location Name")}
        <select name="company_location_id">
          ${renderLocationOptions("", "", { blankLabel: labels.selectLocation || "Select Location", activeOnly: true })}
        </select>
        ${locationFallbackHint ? `<p class="muted">${escapeHtml(locationFallbackHint)}</p>` : ""}
      </label>
      <button type="submit">${escapeHtml(labels.submit)}</button>
    </form>
  `;
}

function customerLocationsSectionHtml(userId) {
  const labels = state.labels.companySetup || {};
  const selectedCustLocId = String(state.customerLocationSelectedId || "").trim();
  const selectedCustLoc = (state.customerLocations || []).find((e) => String(e.id || "") === selectedCustLocId) || null;

  // Only show locations belonging to the current user; if no user yet, show all
  const userLocations = userId
    ? (state.customerLocations || []).filter((loc) => loc.user_id === userId)
    : (state.customerLocations || []);
  const custLocRows = userLocations.map((loc) => `
    <tr>
      ${!userId ? `<td>${escapeHtml(loc.user_code || "-")} - ${escapeHtml(loc.customer_name || "-")}</td>` : ""}
      <td>${escapeHtml(loc.location_name || "-")}</td>
      <td>${escapeHtml(loc.address_line || "-")}</td>
      <td>${loc.is_active ? escapeHtml(state.labels.common?.yes || "Yes") : escapeHtml(state.labels.common?.no || "No")}</td>
      <td><button type="button" data-cust-loc-select="${escapeHtml(loc.id)}">${escapeHtml(labels.edit || "Edit")}</button></td>
    </tr>
  `).join("");
  const colSpan = userId ? 4 : 5;

  return `
    <form id="customer-location-upsert-form" class="grid task-box">
      <p class="form-section-title">${escapeHtml(labels.customerLocationsTitle || "Customer Locations")}</p>
      <input type="hidden" name="loc_id" value="${escapeHtml(selectedCustLoc?.id || "")}" />
      <input type="hidden" name="user_id" value="${escapeHtml(userId)}" />
      <label>${escapeHtml(labels.locationName || "Location Name")}<input name="location_name" required minlength="2" maxlength="120" value="${escapeHtml(selectedCustLoc?.location_name || "")}" /></label>
      <label>${escapeHtml(labels.address || "Address")}<input name="address_line" maxlength="240" value="${escapeHtml(selectedCustLoc?.address_line || "")}" /></label>
      <label>${escapeHtml(labels.active || "Active")}
        <select name="is_active" required>
          <option value="true" ${selectedCustLoc?.is_active !== false ? "selected" : ""}>${escapeHtml(state.labels.common?.yes || "Yes")}</option>
          <option value="false" ${selectedCustLoc?.is_active === false ? "selected" : ""}>${escapeHtml(state.labels.common?.no || "No")}</option>
        </select>
      </label>
      <div class="row">
        <button type="submit">${escapeHtml(labels.saveCustomerLocation || "Save Customer Location")}</button>
      </div>
    </form>
    <div class="task-box">
      <h3>${escapeHtml(labels.customerLocationsTitle || "Customer Locations")}</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>${!userId ? `<th>${escapeHtml(labels.customerUser || "Customer")}</th>` : ""}<th>${escapeHtml(labels.locationName || "Location")}</th><th>${escapeHtml(labels.address || "Address")}</th><th>${escapeHtml(labels.active || "Active")}</th><th>${escapeHtml(labels.actions || "Actions")}</th></tr></thead>
          <tbody>${custLocRows || `<tr><td colspan="${colSpan}" class="muted">No locations found</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function fillerLocationsSectionHtml(userId) {
  const labels = state.labels.companySetup || {};
  const normalizedUserId = String(userId || "").trim();
  const selectedFillerLocId = String(state.fillerLocationSelectedId || "").trim();
  const selectedFillerLoc = (state.fillerLocations || []).find((entry) => {
    if (String(entry.id || "") !== selectedFillerLocId) {
      return false;
    }
    return !normalizedUserId || String(entry.filler_user_id || "") === normalizedUserId;
  }) || null;
  const fillerUser = normalizedUserId
    ? (state.users || []).find((user) => String(user.id || "") === normalizedUserId)
    : null;

  if (!normalizedUserId) {
    return `
      <div class="task-box">
        <h3>${escapeHtml(labels.fillerLocationsTitle || "Filler Locations")}</h3>
        <p class="muted">Create the filler user first, then manage filler locations from Update User.</p>
      </div>
    `;
  }

  if (String(fillerUser?.role || "").trim().toUpperCase() !== "FILLER") {
    return "";
  }

  const userLocations = (state.fillerLocations || []).filter((loc) => String(loc.filler_user_id || "") === normalizedUserId);
  const fillerLocRows = userLocations.map((loc) => `
    <tr>
      <td>${escapeHtml(loc.location_name || "-")}</td>
      <td>${escapeHtml(loc.address_line || "-")}</td>
      <td>${loc.is_active ? escapeHtml(state.labels.common?.yes || "Yes") : escapeHtml(state.labels.common?.no || "No")}</td>
      <td><button type="button" data-filler-loc-select="${escapeHtml(loc.id)}">${escapeHtml(labels.edit || "Edit")}</button></td>
    </tr>
  `).join("");

  return `
    <form id="filler-location-upsert-form" class="grid task-box">
      <p class="form-section-title">${escapeHtml(labels.fillerLocationsTitle || "Filler Locations")}</p>
      <input type="hidden" name="loc_id" value="${escapeHtml(selectedFillerLoc?.id || "")}" />
      <input type="hidden" name="filler_user_id" value="${escapeHtml(normalizedUserId)}" />
      <label>${escapeHtml(labels.locationName || "Location Name")}<input name="location_name" required minlength="2" maxlength="120" value="${escapeHtml(selectedFillerLoc?.location_name || "")}" /></label>
      <label>${escapeHtml(labels.address || "Address")}<input name="address_line" maxlength="240" value="${escapeHtml(selectedFillerLoc?.address_line || "")}" /></label>
      <label>${escapeHtml(labels.active || "Active")}
        <select name="is_active" required>
          <option value="true" ${selectedFillerLoc?.is_active !== false ? "selected" : ""}>${escapeHtml(state.labels.common?.yes || "Yes")}</option>
          <option value="false" ${selectedFillerLoc?.is_active === false ? "selected" : ""}>${escapeHtml(state.labels.common?.no || "No")}</option>
        </select>
      </label>
      <div class="row">
        <button type="submit">${escapeHtml(labels.saveFillerLocation || "Save Filler Location")}</button>
        <button type="button" id="filler-loc-clear-selection">${escapeHtml(labels.clearSelection || "Clear Selection")}</button>
      </div>
    </form>
    <div class="task-box">
      <h3>${escapeHtml(labels.fillerLocationsTitle || "Filler Locations")}</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>${escapeHtml(labels.locationName || "Location")}</th><th>${escapeHtml(labels.address || "Address")}</th><th>${escapeHtml(labels.active || "Active")}</th><th>${escapeHtml(labels.actions || "Actions")}</th></tr></thead>
          <tbody>${fillerLocRows || `<tr><td colspan="4" class="muted">${escapeHtml(labels.noLocations || "No locations found")}</td></tr>`}</tbody>
        </table>
      </div>
    </div>
  `;
}

function companySetupView() {
  const labels = state.labels.companySetup || {};
  if (!canManageCompanySetup()) {
    return `<p class="muted">${escapeHtml(labels.forbidden || "Only Admin can manage company setup")}</p>`;
  }
  if (!state.apiAvailability.companySetup) {
    return `<p class="muted">${escapeHtml(labels.endpointMissing || "Company setup endpoint is not available in current backend")}</p>`;
  }

  // Our company is always the first (single) entry
  const myCompany = (state.companies || [])[0] || null;
  const isCompanyNameLocked = !!String(myCompany?.id || "").trim();

  const selectedLocationId = String(state.companySetupSelectedLocationId || "").trim();
  const selectedLocation = (state.companyLocations || []).find((e) => String(e.id || "") === selectedLocationId) || null;

  const locationRows = (state.companyLocations || []).map((loc) => `
    <tr>
      <td>${escapeHtml(loc.location_name || "-")}</td>
      <td>${escapeHtml(loc.address_line || "-")}</td>
      <td>${loc.is_active ? escapeHtml(state.labels.common?.yes || "Yes") : escapeHtml(state.labels.common?.no || "No")}</td>
      <td><button type="button" data-location-select="${escapeHtml(loc.id)}">${escapeHtml(labels.edit || "Edit")}</button></td>
    </tr>
  `).join("");

  return `
    <div class="view-stack">

      <!-- MY COMPANY (single) -->
      <form id="company-upsert-form" class="grid task-box">
        <p class="form-section-title">${escapeHtml(labels.companyTitle || "My Company")}</p>
        <input type="hidden" name="company_id" value="${escapeHtml(myCompany?.id || "")}" />
        <label>${escapeHtml(labels.companyName || "Company Name")}<input name="company_name" required minlength="2" maxlength="120" value="${escapeHtml(myCompany?.company_name || "")}" ${isCompanyNameLocked ? "readonly" : ""} /></label>
        ${isCompanyNameLocked ? `<p class="muted">${escapeHtml(labels.companyNameLockedHint || "Company Name is locked after initial setup")}</p>` : ""}
        <label>${escapeHtml(labels.companyContact || "Contact Info")}<input name="contact_info" maxlength="240" value="${escapeHtml(myCompany?.contact_info || "")}" /></label>
        <label>${escapeHtml(labels.active || "Active")}
          <select name="is_active" required>
            <option value="true" ${myCompany?.is_active !== false ? "selected" : ""}>${escapeHtml(state.labels.common?.yes || "Yes")}</option>
            <option value="false" ${myCompany?.is_active === false ? "selected" : ""}>${escapeHtml(state.labels.common?.no || "No")}</option>
          </select>
        </label>
        <button type="submit">${escapeHtml(labels.saveCompany || "Save Company")}</button>
      </form>

      <!-- OUR LOCATIONS (multiple) -->
      <form id="company-location-upsert-form" class="grid task-box">
        <p class="form-section-title">${escapeHtml(labels.locationTitle || "Our Locations / Godowns")}</p>
        <input type="hidden" name="location_id" value="${escapeHtml(selectedLocation?.id || "")}" />
        <input type="hidden" name="company_id" value="${escapeHtml(myCompany?.id || "")}" />
        <label>${escapeHtml(labels.locationName || "Location Name")}<input name="location_name" required minlength="2" maxlength="120" value="${escapeHtml(selectedLocation?.location_name || "")}" /></label>
        <label>${escapeHtml(labels.address || "Address")}<input name="address_line" maxlength="240" value="${escapeHtml(selectedLocation?.address_line || "")}" /></label>
        <label>${escapeHtml(labels.active || "Active")}
          <select name="is_active" required>
            <option value="true" ${selectedLocation?.is_active !== false ? "selected" : ""}>${escapeHtml(state.labels.common?.yes || "Yes")}</option>
            <option value="false" ${selectedLocation?.is_active === false ? "selected" : ""}>${escapeHtml(state.labels.common?.no || "No")}</option>
          </select>
        </label>
        <div class="row">
          <button type="submit">${escapeHtml(labels.saveLocation || "Save Location")}</button>
          <button type="button" id="location-clear-selection">${escapeHtml(labels.clearSelection || "Clear Selection")}</button>
        </div>
      </form>
      <div class="task-box">
        <h3>${escapeHtml(labels.locationsListTitle || "Our Locations")}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${escapeHtml(labels.locationName || "Location Name")}</th><th>${escapeHtml(labels.address || "Address")}</th><th>${escapeHtml(labels.active || "Active")}</th><th>${escapeHtml(labels.actions || "Actions")}</th></tr></thead>
            <tbody>${locationRows || `<tr><td colspan="4" class="muted">${escapeHtml(labels.noLocations || "No locations found")}</td></tr>`}</tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
function itemUpdateView() {
  const labels = state.labels.itemUpdate;
  if (!canUpdateItems()) {
    return `<p class="muted">${escapeHtml(labels.adminOnly || "Only Admin can update items")}</p>`;
  }
  const firstItem = state.items[0] || null;
  const firstItemType = firstItem?.item_type || "CONTAINER";
  const firstVolumeUnit = firstItem?.volume_unit || "";
  const options = state.items
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.item_code)} - ${escapeHtml(item.title)}</option>`)
    .join("");

  return `
    <form id="item-update-form" class="grid">
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.selectItem || "Select Item")}</p>
      <label>${escapeHtml(labels.item)}
        <select name="item_id" required>${options}</select>
      </label>
      <input name="expected_updated_at" type="hidden" />
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.basicInfo || "Basic Info")}</p>
      <label>${escapeHtml(labels.category)}
        <select name="category_select" required>
          ${renderCategorySelectOptions(firstItem?.category || "", { includeCustom: false })}
        </select>
      </label>
      <label>${escapeHtml(labels.itemId)}<input name="item_code_display" readonly /></label>
      <label>${escapeHtml(labels.customId || "Custom ID")}
        <input name="custom_id" minlength="2" maxlength="50" placeholder="A-Z, 0-9, -, _" />
      </label>
      <p class="muted">${escapeHtml(labels.customIdUpdateHint || "Custom ID can be updated, but each ID must stay unique.")}</p>
      <label>${escapeHtml(labels.title)}<input name="title" required minlength="2" maxlength="200" /></label>
      <label>${escapeHtml(labels.ownership || "Ownership")}
        <select name="ownership_type" required>
          <option value="OURS">${escapeHtml(labels.ownershipOurs || "Self / Company")}</option>
          <option value="EXTERNAL">${escapeHtml(labels.ownershipExternal || "External Partner")}</option>
        </select>
      </label>
      <label data-external-owner-field style="display:none">${escapeHtml(labels.ownerName || "Owner Name (External Partner)")}
        <select name="external_owner_name">
          ${renderExternalPartnerOwnerOptions("", { blankLabel: labels.selectExternalPartner || "Select External Partner" })}
        </select>
      </label>
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.specifications || "Specifications")}</p>
      <label>${escapeHtml(labels.itemType || "Type")}
        <select name="item_type" required>
          ${renderItemTypeOptions(firstItemType)}
        </select>
      </label>
      <label><span data-capacity-text>${escapeHtml(labels.sizeCapacity || labels.capacity)}</span><input name="capacity" type="number" required min="0.01" step="0.01" /></label>
      <label data-volume-unit-field>${escapeHtml(labels.volumeUnit || "Volume Unit")}
        <select name="volume_unit">
          ${renderVolumeUnitOptions(firstVolumeUnit)}
        </select>
      </label>
      <input name="status" type="hidden" value="${escapeHtml(firstItem?.status || "WITH_ME")}" />
      <input name="company_location_id" type="hidden" value="${escapeHtml(firstItem?.company_location_id || "")}" />
      <label><span>${escapeHtml(labels.itemState)}</span>
        ${renderFillStateRadioGroup("fill_state", firstItem?.fill_state || "EMPTY")}
      </label>
      <button type="submit">${escapeHtml(labels.submit)}</button>
    </form>
  `;
}

function userCreateView() {
  const labels = state.labels.userCreate;
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(state.user?.role || "");
  if (!isAdmin) {
    return `<p class="muted">${escapeHtml(labels.adminOnly)}</p>`;
  }

  return `
  <div class="view-stack">
    <form id="user-create-form" class="grid">
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.basicInfo || "Basic Info")}</p>
      <label>${escapeHtml(labels.userId)}<input value="${escapeHtml(labels.autoGeneratedId)}" readonly /></label>
      <label>${escapeHtml(labels.fullName)}<input name="full_name" required minlength="2" maxlength="120" /></label>
      <label>${escapeHtml(labels.email)}<input name="email" type="email" required /></label>
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.security || "Security")}</p>
      <label>${escapeHtml(labels.password)}<input name="password" type="password" required minlength="8" maxlength="128" data-strength-input="user-create-password" /></label>
      <p class="muted" data-strength-meter="user-create-password">Password strength:</p>
      <label>${escapeHtml(labels.securityKey1 || state.labels.login.securityKey1)}<input name="security_key_1" type="password" minlength="3" maxlength="120" /></label>
      <label>${escapeHtml(labels.securityKey2 || state.labels.login.securityKey2)}<input name="security_key_2" type="password" minlength="3" maxlength="120" /></label>
      <label>${escapeHtml(labels.securityKey3 || state.labels.login.securityKey3)}<input name="security_key_3" type="password" minlength="3" maxlength="120" /></label>
      <p class="muted">${escapeHtml(labels.passwordRule || "Password must include upper, lower, number and symbol")}</p>
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.role || "Role")}</p>
      <label>${escapeHtml(labels.role)}
        <select name="role" required>
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="FILLER">FILLER</option>
          <option value="DELIVERY_PARTNER">DELIVERY_PARTNER</option>
          <option value="EXTERNAL_PARTNER">External Partner</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </label>
      <p class="form-section-title" data-fill-policy-title>${escapeHtml(labels.emptyItemPolicyTitle || "EMPTY Item Policy")}</p>
      <label data-reject-full-policy>
        <input type="checkbox" name="reject_full_items" />
        ${escapeHtml(labels.rejectFullItems || "Do not allow FULL items for this user")}
      </label>
      <label data-reject-empty-policy>
        <input type="checkbox" name="reject_empty_items" />
        ${escapeHtml(labels.rejectEmptyItems || "Do not allow EMPTY items for this user")}
      </label>
      <button type="submit">${escapeHtml(labels.submit)}</button>
    </form>
    ${customerLocationsSectionHtml("")}
  </div>
  `;
}

function userUpdateView() {
  const labels = state.labels.userUpdate;
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(state.user?.role || "");
  if (!isAdmin) {
    return `<p class="muted">${escapeHtml(labels.adminOnly)}</p>`;
  }

  const editableUsers = (state.users || []).filter((user) => String(user.role || "").trim().toUpperCase() !== "SUPER_ADMIN");
  if (editableUsers.length === 0) {
    return `<p class="muted">${escapeHtml("No editable users found. Super Admin can be updated only from Profile page.")}</p>`;
  }

  const userOptions = editableUsers
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.email)} (${escapeHtml(user.role)})</option>`)
    .join("");

  const firstUser = editableUsers[0];
  const selectedUserId = firstUser?.id || "";

  return `
  <div class="view-stack">
    <form id="user-update-form" class="grid">
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.selectUser || "Select User")}</p>
      <label>${escapeHtml(labels.user)}
        <select name="user_id" required>${userOptions}</select>
      </label>
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.basicInfo || "Basic Info")}</p>
      <label>${escapeHtml(labels.userId)}<input name="user_code_display" readonly /></label>
      <label>${escapeHtml(labels.fullName)}<input name="full_name" required minlength="2" maxlength="120" /></label>
      <label>${escapeHtml(labels.email)}<input name="email" type="email" required /></label>
      <label>${escapeHtml(labels.active)}
        <select name="is_active" required>
          <option value="true">${escapeHtml(state.labels.common.yes)}</option>
          <option value="false">${escapeHtml(state.labels.common.no)}</option>
        </select>
      </label>
      <label>${escapeHtml(labels.role || state.labels.roleUpdate.role)}
        <select name="role" required>
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="FILLER">FILLER</option>
          <option value="DELIVERY_PARTNER">DELIVERY_PARTNER</option>
          <option value="EXTERNAL_PARTNER">External Partner</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </label>
      <p class="form-section-title" data-fill-policy-title>${escapeHtml(labels.emptyItemPolicyTitle || "EMPTY Item Policy")}</p>
      <label data-reject-full-policy>
        <input type="checkbox" name="reject_full_items" />
        ${escapeHtml(labels.rejectFullItems || "Do not allow FULL items for this user")}
      </label>
      <label data-reject-empty-policy>
        <input type="checkbox" name="reject_empty_items" />
        ${escapeHtml(labels.rejectEmptyItems || "Do not allow EMPTY items for this user")}
      </label>
      <p class="form-section-title">${escapeHtml(state.labels.formSections?.securityOptional || "Security (Optional)")}</p>
      <label>${escapeHtml(labels.newPassword)}<input name="new_password" type="password" data-strength-input="user-update-password" /></label>
      <p class="muted" data-strength-meter="user-update-password">Password strength:</p>
      <p class="muted">${escapeHtml(labels.securityKeysHint || "Set all 3 security keys to reset recovery keys")}</p>
      <label>${escapeHtml(labels.securityKey1 || state.labels.login.securityKey1)}<input name="security_key_1" type="password" maxlength="120" /></label>
      <label>${escapeHtml(labels.securityKey2 || state.labels.login.securityKey2)}<input name="security_key_2" type="password" maxlength="120" /></label>
      <label>${escapeHtml(labels.securityKey3 || state.labels.login.securityKey3)}<input name="security_key_3" type="password" maxlength="120" /></label>
      <button type="submit">${escapeHtml(labels.submit)}</button>
    </form>
    ${customerLocationsSectionHtml(state.customerLocationsViewUserId || selectedUserId)}
    ${fillerLocationsSectionHtml(selectedUserId)}
  </div>
  `;
}

function roleUpdateView() {
  const labels = state.labels.roleUpdate;
  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(state.user?.role || "");
  if (!isAdmin) {
    return `<p class="muted">${escapeHtml(labels.adminOnly)}</p>`;
  }

  if (!state.apiAvailability.updateRole) {
    return `<p class="muted">${escapeHtml(labels.endpointMissing || "Role update endpoint is not available in current backend")}</p>`;
  }

  const editableUsers = (state.users || []).filter((user) => String(user.role || "").trim().toUpperCase() !== "SUPER_ADMIN");
  if (editableUsers.length === 0) {
    return `<p class="muted">${escapeHtml("No editable users found. Super Admin role is fixed.")}</p>`;
  }

  const userOptions = editableUsers
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.email)} (${escapeHtml(user.role)})</option>`)
    .join("");

  return `
    <form id="role-update-form" class="grid">
      <label>${escapeHtml(labels.user)}
        <select name="user_id" required>${userOptions}</select>
      </label>
      <label>${escapeHtml(labels.userId)}<input name="user_code_display" readonly /></label>
      <label>${escapeHtml(labels.role)}
        <select name="role" required>
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="FILLER">FILLER</option>
          <option value="DELIVERY_PARTNER">DELIVERY_PARTNER</option>
          <option value="EXTERNAL_PARTNER">External Partner</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </label>
      <button type="submit">${escapeHtml(labels.submit)}</button>
    </form>
  `;
}

function loginControlsView() {
  const labels = state.labels.loginControls;
  if (!canAccessLoginControls()) {
    return `<p class="muted">${escapeHtml(labels.adminOnly)}</p>`;
  }

  const userOptions = state.users
    .map(
      (user) =>
        `<option value="${escapeHtml(user.id)}" ${state.loginControlsUserId === user.id ? "selected" : ""}>${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.email)} (${escapeHtml(user.role)})</option>`
    )
    .join("");

  return `
    <div class="view-stack">

    <div class="task-box">
      <form id="login-controls-filter-form" class="grid">
        <h3>${escapeHtml(labels.filterTitle || "Select User")}</h3>
        <label>${escapeHtml(labels.user)}
          <select name="user_id" required>${userOptions}</select>
        </label>
        <button type="submit">${escapeHtml(labels.load)}</button>
      </form>
    </div>

    <div class="task-box">
      <form id="login-controls-add-form" class="grid">
        <h3>${escapeHtml(labels.addTitle || "Add MAC Address")}</h3>
        <label>${escapeHtml(labels.systemName)}<input name="system_name" maxlength="120" /></label>
        <label>${escapeHtml(labels.macAddress)}<input name="mac_address" required placeholder="AA:BB:CC:DD:EE:FF" /></label>
        <button type="submit">${escapeHtml(labels.add)}</button>
      </form>
    </div>

    <div class="task-box">
      <h3>${escapeHtml(labels.listTitle || "Registered Devices")}</h3>
      <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(labels.systemName)}</th>
            <th>${escapeHtml(labels.macAddress)}</th>
            <th>${escapeHtml(labels.active)}</th>
            <th>${escapeHtml(labels.createdAt)}</th>
            <th>${escapeHtml(labels.action)}</th>
          </tr>
        </thead>
        <tbody>
          ${state.loginControls
            .map(
              (control) => `
                <tr>
                  <td>${escapeHtml(control.system_name || "-")}</td>
                  <td class="code">${escapeHtml(control.mac_address)}</td>
                  <td>${control.is_active ? escapeHtml(state.labels.common.yes) : escapeHtml(state.labels.common.no)}</td>
                  <td>${escapeHtml(control.created_at || "-")}</td>
                  <td>
                    ${
                      control.is_active
                        ? `<button data-deactivate-control="${escapeHtml(control.id)}" type="button">${escapeHtml(labels.deactivate)}</button>`
                        : "-"
                    }
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      </div>
    </div>

    </div>
  `;
}

function sessionsView() {
  const labels = state.labels.sessions;
  const searchFilter = String(state.sessionSearchFilter || "").trim().toLowerCase();
  const activeFilter = String(state.sessionActiveFilter || "").trim().toLowerCase();
  const filteredSessions = (state.sessions || []).filter((session) => {
    if (activeFilter) {
      const isActive = !!session.is_active;
      if ((activeFilter === "active" && !isActive) || (activeFilter === "inactive" && isActive)) {
        return false;
      }
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [session.device_fingerprint, session.ip_address, session.created_at]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });
  return `
    <div class="task-box list-scroll-shell">
    <div class="list-scroll-head">
    <div class="row" style="margin-bottom:var(--sp-2)">
      <label style="max-width:320px">Search
        <input id="sessions-search-filter" type="text" value="${escapeHtml(state.sessionSearchFilter || "")}" placeholder="Device, IP, time" />
      </label>
      <label style="max-width:200px">Active
        <select id="sessions-active-filter">
          <option value="">All</option>
          <option value="active" ${activeFilter === "active" ? "selected" : ""}>${escapeHtml(state.labels.common.yes || "Yes")}</option>
          <option value="inactive" ${activeFilter === "inactive" ? "selected" : ""}>${escapeHtml(state.labels.common.no || "No")}</option>
        </select>
      </label>
    </div>
    </div>
    <div class="table-wrap list-scroll-content">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(labels.device)}</th>
            <th>${escapeHtml(labels.ip)}</th>
            <th>${escapeHtml(labels.active)}</th>
            <th>${escapeHtml(labels.created)}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredSessions
            .map(
              (session) => `
                <tr>
                  <td class="code">${escapeHtml(session.device_fingerprint)}</td>
                  <td>${escapeHtml(session.ip_address || "-")}</td>
                  <td>${session.is_active ? escapeHtml(state.labels.common.yes) : escapeHtml(state.labels.common.no)}</td>
                  <td>${escapeHtml(session.created_at)}</td>
                </tr>
              `
            )
            .join("") || `<tr><td colspan="4" class="muted">No matching sessions</td></tr>`}
        </tbody>
      </table>
    </div>
    </div>
  `;
}

function activityView() {
  const canSee = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  if (!canSee) {
    return `<p class="muted">Forbidden</p>`;
  }
  const searchFilter = String(state.activitySearchFilter || "").trim().toLowerCase();
  const actionFilter = String(state.activityActionFilter || "").trim().toUpperCase();
  const logs = state.activityLogs || [];
  const actionOptions = Array.from(new Set(logs.map((entry) => String(entry.action || "").trim()).filter(Boolean))).sort();
  const filteredLogs = logs.filter((entry) => {
    if (actionFilter && String(entry.action || "").trim().toUpperCase() !== actionFilter) {
      return false;
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [entry.actor_name, entry.action, entry.entity_type, entry.entity_label, entry.created_at]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });
  const ACTION_BADGE = {
    LOGIN: "badge-green",
    LOGOUT: "badge-muted",
    CREATE: "badge-blue",
    UPDATE: "badge-yellow",
    DELETE: "badge-red",
    APPROVE: "badge-green",
    REJECT: "badge-red"
  };
  const rows = filteredLogs.map((entry) => {
    const badgeClass = ACTION_BADGE[entry.action] || "badge-muted";
    return `
      <tr>
        <td>${escapeHtml(entry.created_at || "-")}</td>
        <td>${escapeHtml(entry.actor_name || "-")}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(entry.action)}</span></td>
        <td>${escapeHtml(entry.entity_type || "-")}</td>
        <td class="muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(entry.entity_label || "")}">${escapeHtml(entry.entity_label || "-")}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="5" class="muted">No activity records yet</td></tr>`;

  return `
    <div class="view-stack">
    <div class="task-box list-scroll-shell">
      <div class="list-scroll-head">
      <div class="row" style="margin-bottom:var(--sp-2)">
        <label style="max-width:320px">Search
          <input id="activity-search-filter" type="text" value="${escapeHtml(state.activitySearchFilter || "")}" placeholder="User, action, type, detail" />
        </label>
        <label style="max-width:220px">Action
          <select id="activity-action-filter">
            <option value="">All</option>
            ${actionOptions.map((action) => `<option value="${escapeHtml(action)}" ${actionFilter === action.toUpperCase() ? "selected" : ""}>${escapeHtml(action)}</option>`).join("")}
          </select>
        </label>
      </div>
      </div>
      <div class="table-wrap list-scroll-content">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Type</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    </div>
  `;
}

function logsView() {
  const labels = state.labels.logs;
  const canSeeLogs = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  if (!canSeeLogs) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }

  const deliveryFilter = String(state.logDeliveryNoFilter || "").trim();
  const searchFilter = String(state.logSearchFilter || "").trim().toLowerCase();
  const actionFilter = String(state.logActionFilter || "").trim().toUpperCase();
  const actionOptions = Array.from(new Set((state.logs || []).map((log) => String(log.action || "").trim()).filter(Boolean))).sort();
  const filteredLogs = (state.logs || []).filter((log) => {
    if (deliveryFilter && !String(log.delivery_no || "").includes(deliveryFilter)) {
      return false;
    }
    if (actionFilter && String(log.action || "").trim().toUpperCase() !== actionFilter) {
      return false;
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [log.action, log.entity_type, log.delivery_no, log.checksum, log.created_at]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });

  return `
    <div class="view-stack">
    <div class="task-box list-scroll-shell">
      <div class="list-scroll-head">
      <div class="row" style="margin-bottom:var(--sp-2)">
        <button id="verify-logs">${escapeHtml(labels.verify)}</button>
        <p id="verify-result" class="muted"></p>
      </div>
      <div class="row" style="margin-bottom:var(--sp-2)">
        <label style="max-width:320px">Search
          <input id="logs-search-filter" type="text" value="${escapeHtml(state.logSearchFilter || "")}" placeholder="Action, entity, checksum" />
        </label>
        <label style="max-width:220px">Action
          <select id="logs-action-filter">
            <option value="">All</option>
            ${actionOptions.map((action) => `<option value="${escapeHtml(action)}" ${actionFilter === action.toUpperCase() ? "selected" : ""}>${escapeHtml(action)}</option>`).join("")}
          </select>
        </label>
        <label style="max-width:320px">${escapeHtml(labels.searchDeliveryNo || "Search Delivery No")}
          <input id="logs-delivery-no-filter" type="text" value="${escapeHtml(deliveryFilter)}" placeholder="${escapeHtml(labels.searchDeliveryNo || "Search Delivery No")}" />
        </label>
      </div>
      </div>
      <div class="table-wrap list-scroll-content">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(labels.action)}</th>
            <th>${escapeHtml(labels.entity)}</th>
            <th>${escapeHtml(labels.deliveryNo || "Delivery No")}</th>
            <th>${escapeHtml(labels.checksum)}</th>
            <th>${escapeHtml(labels.time)}</th>
          </tr>
        </thead>
        <tbody>
          ${filteredLogs
            .map(
              (log) => `
                <tr>
                  <td>${escapeHtml(log.action)}</td>
                  <td>${escapeHtml(log.entity_type)}</td>
                  <td>${escapeHtml(log.delivery_no || "-")}</td>
                  <td class="code">${escapeHtml(log.checksum.slice(0, 16))}...</td>
                  <td>${escapeHtml(log.created_at)}</td>
                </tr>
              `
            )
            .join("") || `<tr><td colspan="5" class="muted">${escapeHtml(labels.empty || "No logs")}</td></tr>`}
        </tbody>
      </table>
      </div>
    </div>
    </div>
  `;
}

function analyticsRowsTable(title, rows) {
  const filters = state.analyticsFilters || {};
  const normalizedTitle = String(title || "").toLowerCase();
  const isItemSection = normalizedTitle.includes("item");
  const isUserSection = normalizedTitle.includes("user");
  const isTimeSection = normalizedTitle.includes("time");
  const defaultCompanyName = String(
    (state.companies || []).find((company) => company?.is_active !== false)?.company_name
    || (state.companies || [])[0]?.company_name
    || ""
  ).trim();
  const viewMode = String(filters.view_mode || "simple").toLowerCase();
  const rowLimitRaw = String(filters.row_limit || "50").trim().toLowerCase();
  const sectionMeta = (() => {
    const normalized = normalizedTitle;
    const count = Array.isArray(rows) ? rows.length : 0;
    const sparkSeed = Math.max(count, 1);
    const sparkValues = [
      ((sparkSeed % 5) + 3) * 12,
      ((Math.floor(sparkSeed / 2) % 5) + 3) * 12,
      ((Math.floor(sparkSeed / 3) % 5) + 3) * 12,
      ((Math.floor(sparkSeed / 4) % 5) + 3) * 12,
    ];
    if (normalized.includes("user")) {
      return { icon: "U", sparkValues };
    }
    if (normalized.includes("item")) {
      return { icon: "I", sparkValues };
    }
    if (normalized.includes("delivery")) {
      return { icon: "D", sparkValues };
    }
    if (normalized.includes("time")) {
      return { icon: "T", sparkValues };
    }
    return { icon: "A", sparkValues };
  })();
  const sectionThemeClass = (() => {
    const normalized = normalizedTitle;
    if (normalized.includes("user")) {
      return "analytics-section-user";
    }
    if (normalized.includes("item")) {
      return "analytics-section-item";
    }
    if (normalized.includes("delivery")) {
      return "analytics-section-delivery";
    }
    if (normalized.includes("time")) {
      return "analytics-section-time";
    }
    return "";
  })();
  const resolvePreferredColumns = () => {
    const normalized = String(title || "").toLowerCase();
    if (viewMode !== "simple") {
      return null;
    }
    if (normalized.includes("user")) {
      return ["role", "user_count", "active_count"];
    }
    if (normalized.includes("item")) {
      return ["item_code", "title", "status", "fill_state", "dc_book_id", "dc_number", "dc_updated_at", "cycle_count", "warning_active", "updated_at"];
    }
    if (normalized.includes("delivery")) {
      return ["delivery_user_name", "delivery_user_id", "delivery_count", "updated_at"];
    }
    if (normalized.includes("time")) {
      return ["period", "transfer_count"];
    }
    return null;
  };
  const formatColumnLabel = (column) => {
    const predefined = {
      user_count: "User Count",
      active_count: "Active Users",
      item_code: "Item Code",
      fill_state: "Fill State",
      cycle_count: "Cycle Count",
      warning_active: "Warning",
      warning_reason: "Warning Reason",
      dc_book_id: "DC Book",
      dc_number: "DC Number",
      dc_updated_at: "DC Updated At",
      created_at: "Created At",
      updated_at: "Updated At",
      transfer_count: "Transfer Count",
    };
    if (predefined[column]) {
      return predefined[column];
    }
    return String(column || "")
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };
  const formatCellValue = (column, value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (column === "warning_active") {
      return String(value) === "true" || value === true ? "Active" : "Clear";
    }
    if (column === "created_at" || column === "updated_at" || column === "dc_updated_at") {
      const isoValue = String(value || "");
      return isoValue.replace("T", " ").replace(/\+00:00$/, " UTC");
    }
    if (column === "status") {
      const statusValue = String(value || "").trim().toUpperCase();
      if (statusValue === "WITH_ME") {
        return defaultCompanyName || formatItemStatusLabel(statusValue);
      }
      if (statusValue === "WITH_CLIENT") {
        return state.labels?.items?.withClientLabel || "Customer";
      }
      return formatItemStatusLabel(statusValue || value);
    }
    return String(value);
  };
  const renderCell = (column, value) => {
    const formatted = formatCellValue(column, value);
    if (column === "warning_active") {
      const active = formatted === "Active";
      return `<span class="badge ${active ? "badge-yellow" : "badge-green"}">${escapeHtml(formatted)}</span>`;
    }
    if (column === "fill_state") {
      return renderFillStateBadge(formatted);
    }
    if (column === "status" || column === "role") {
      return `<span class="analytics-pill">${escapeHtml(formatted)}</span>`;
    }
    if (["user_count", "active_count", "cycle_count", "transfer_count", "dc_number"].includes(column)) {
      return `<strong class="analytics-number">${escapeHtml(formatted)}</strong>`;
    }
    return escapeHtml(formatted);
  };

  const quickFiltersHtml = isItemSection
    ? `
      <div class="analytics-quick-filters">
        <button type="button" data-analytics-chip="item_status:all" class="${String(filters.item_status || "all").toUpperCase() === "ALL" ? "active" : ""}">All Status</button>
        <button type="button" data-analytics-chip="item_status:WITH_ME" class="${String(filters.item_status || "all").toUpperCase() === "WITH_ME" ? "active" : ""}">${escapeHtml(defaultCompanyName || formatItemStatusLabel("WITH_ME"))}</button>
        <button type="button" data-analytics-chip="item_status:WITH_CLIENT" class="${String(filters.item_status || "all").toUpperCase() === "WITH_CLIENT" ? "active" : ""}">${escapeHtml(state.labels?.items?.withClientLabel || "Customer")}</button>
        <button type="button" data-analytics-chip="item_fill_state:FULL" class="${String(filters.item_fill_state || "all").toUpperCase() === "FULL" ? "active" : ""}">FULL</button>
        <button type="button" data-analytics-chip="item_fill_state:EMPTY" class="${String(filters.item_fill_state || "all").toUpperCase() === "EMPTY" ? "active" : ""}">EMPTY</button>
        <button type="button" data-analytics-chip="item_warning:warning" class="${String(filters.item_warning || "all").toLowerCase() === "warning" ? "active" : ""}">Warning</button>
        <button type="button" data-analytics-chip="item_warning:clear" class="${String(filters.item_warning || "all").toLowerCase() === "clear" ? "active" : ""}">Clear</button>
        <button type="button" data-analytics-chip="item_dc_link:linked" class="${String(filters.item_dc_link || "all").toLowerCase() === "linked" ? "active" : ""}">Book Linked</button>
        <button type="button" data-analytics-chip="item_dc_link:not_linked" class="${String(filters.item_dc_link || "all").toLowerCase() === "not_linked" ? "active" : ""}">No Book</button>
      </div>
    `
    : isUserSection
      ? `
        <div class="analytics-quick-filters">
          <button type="button" data-analytics-chip="user_role:all" class="${String(filters.user_role || "all").toUpperCase() === "ALL" ? "active" : ""}">All Roles</button>
          ${Array.from(new Set((rows || []).map((row) => String(row.role || "").trim().toUpperCase()).filter(Boolean)))
            .sort()
            .map((role) => `<button type="button" data-analytics-chip="user_role:${escapeHtml(role)}" class="${String(filters.user_role || "all").toUpperCase() === role ? "active" : ""}">${escapeHtml(role)}</button>`)
            .join("")}
        </div>
      `
      : isTimeSection
        ? `
          <div class="analytics-quick-filters">
            <button type="button" data-analytics-chip="group_by:year" class="${String(filters.group_by || "month").toLowerCase() === "year" ? "active" : ""}">Year</button>
            <button type="button" data-analytics-chip="group_by:month" class="${String(filters.group_by || "month").toLowerCase() === "month" ? "active" : ""}">Month</button>
            <button type="button" data-analytics-chip="group_by:date" class="${String(filters.group_by || "month").toLowerCase() === "date" ? "active" : ""}">Date</button>
          </div>
        `
        : "";

  if (!rows || rows.length === 0) {
    return `
      <div class="task-box analytics-section-card ${sectionThemeClass}">
        <div class="analytics-section-head">
          <div class="analytics-section-title-wrap">
            <span class="analytics-section-icon">${escapeHtml(sectionMeta.icon)}</span>
            <div>
              <h3>${escapeHtml(title)}</h3>
              <p class="muted analytics-section-copy">No records match the current filter set</p>
            </div>
          </div>
          <div class="analytics-section-aside">
            <div class="analytics-sparkline" aria-hidden="true">
              ${sectionMeta.sparkValues.map((value) => `<span style="height:${value}%"></span>`).join("")}
            </div>
          </div>
        </div>
        ${quickFiltersHtml}
        <p class="muted">No data</p>
      </div>
    `;
  }
  const preferredColumns = resolvePreferredColumns();
  const allColumns = Object.keys(rows[0]);
  const columns = preferredColumns ? preferredColumns.filter((column) => allColumns.includes(column)) : allColumns;
  const numericRowLimit = rowLimitRaw === "all" ? rows.length : Math.max(parseInt(rowLimitRaw, 10) || rows.length, 1);
  const visibleRows = rows.slice(0, numericRowLimit);
  return `
    <div class="task-box analytics-section-card ${sectionThemeClass}">
      <div class="analytics-section-head">
        <div class="analytics-section-title-wrap">
          <span class="analytics-section-icon">${escapeHtml(sectionMeta.icon)}</span>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p class="muted analytics-section-copy">Showing ${escapeHtml(visibleRows.length)} of ${escapeHtml(rows.length)} ${rows.length === 1 ? "record" : "records"}</p>
          </div>
        </div>
        <div class="analytics-section-aside">
          <div class="analytics-sparkline" aria-hidden="true">
            ${sectionMeta.sparkValues.map((value) => `<span style="height:${value}%"></span>`).join("")}
          </div>
          <span class="analytics-section-count">${escapeHtml(rows.length)}</span>
        </div>
      </div>
      ${quickFiltersHtml}
      <div class="table-wrap">
        <table class="analytics-table">
          <thead>
            <tr>${columns.map((column) => `<th>${escapeHtml(formatColumnLabel(column))}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${visibleRows
              .map(
                (row) =>
                  `<tr>${columns.map((column) => `<td>${renderCell(column, row[column])}</td>`).join("")}</tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function toDateKey(isoValue, groupBy) {
  const value = String(isoValue || "");
  if (!value) {
    return "";
  }
  if (groupBy === "year") {
    return value.slice(0, 4);
  }
  if (groupBy === "date") {
    return value.slice(0, 10);
  }
  return value.slice(0, 7);
}

function buildLocalAnalyticsResult() {
  const filters = state.analyticsFilters || {};
  const analyticsType = String(filters.analytics_type || "all").toLowerCase();
  const groupBy = String(filters.group_by || "month").toLowerCase();
  const includeAll = analyticsType === "all";

  const summary = {};
  const sections = {};

  if (includeAll || analyticsType === "user") {
    const roleMap = new Map();
    for (const user of state.users || []) {
      const role = user.role || "UNKNOWN";
      const prev = roleMap.get(role) || { role, user_count: 0, active_count: 0 };
      prev.user_count += 1;
      if (user.is_active) {
        prev.active_count += 1;
      }
      roleMap.set(role, prev);
    }
    sections.user = Array.from(roleMap.values());
    summary.total_users = sections.user.reduce((acc, row) => acc + Number(row.user_count || 0), 0);
  }

  if (includeAll || analyticsType === "item") {
    const itemIdFilter = String(filters.item_id || "").trim();
    let rows = [...(state.items || [])];
    if (itemIdFilter) {
      rows = rows.filter((item) => item.id === itemIdFilter || item.item_code === itemIdFilter);
    }
    sections.item = rows.map((item) => ({
      id: item.id,
      item_code: item.item_code,
      title: item.title,
      status: item.status,
      fill_state: item.fill_state,
      dc_book_id: item.dc_book_id || item.link_dc_book_id || "",
      dc_number: item.dc_number || item.link_dc_number || null,
      dc_updated_at: item.dc_updated_at || item.last_transition_at || "",
      cycle_count: item.cycle_count,
      warning_active: item.warning_active,
      warning_reason: item.warning_reason,
      created_at: item.created_at,
      updated_at: item.updated_at
    }));
    summary.total_items = sections.item.length;
  }

  if (includeAll || analyticsType === "delivery") {
    sections.delivery = [];
    summary.total_transfers = 0;
  }

  if (includeAll || ["year", "month", "date", "time"].includes(analyticsType)) {
    const periodMap = new Map();
    for (const item of state.items || []) {
      const period = toDateKey(item.updated_at || item.created_at || "", groupBy);
      if (!period) {
        continue;
      }
      periodMap.set(period, (periodMap.get(period) || 0) + 1);
    }
    sections.time = Array.from(periodMap.entries())
      .map(([period, transfer_count]) => ({ period, transfer_count }))
      .sort((a, b) => String(b.period).localeCompare(String(a.period)));
  }

  return applyAnalyticsDisplayFilters({
    analytics_type: analyticsType,
    group_by: groupBy,
    summary,
    sections,
    localFallback: true
  });
}

function applyItemAnalyticsFilters(rows) {
  const statusFilter = String(state.analyticsFilters?.item_status || "all").trim().toUpperCase();
  const fillStateFilter = String(state.analyticsFilters?.item_fill_state || "all").trim().toUpperCase();
  const warningFilter = String(state.analyticsFilters?.item_warning || "all").trim().toLowerCase();
  const dcLinkFilter = String(state.analyticsFilters?.item_dc_link || "all").trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (statusFilter !== "ALL" && String(row.status || "").trim().toUpperCase() !== statusFilter) {
      return false;
    }
    if (fillStateFilter !== "ALL" && normalizeFillState(row.fill_state) !== fillStateFilter) {
      return false;
    }
    if (warningFilter !== "all") {
      const isWarning = !!row.warning_active;
      if (warningFilter === "warning" && !isWarning) {
        return false;
      }
      if (warningFilter === "clear" && isWarning) {
        return false;
      }
    }
    if (dcLinkFilter !== "all") {
      const hasDcLink = !!String(row.dc_book_id || "").trim() && row.dc_number !== null && row.dc_number !== undefined && String(row.dc_number || "").trim() !== "";
      if (dcLinkFilter === "linked" && !hasDcLink) {
        return false;
      }
      if (dcLinkFilter === "not_linked" && hasDcLink) {
        return false;
      }
    }
    return true;
  });
}

function applyAnalyticsDisplayFilters(payload) {
  if (!isPlainObject(payload)) {
    return payload;
  }
  const sections = isPlainObject(payload.sections) ? { ...payload.sections } : {};
  const userRoleFilter = String(state.analyticsFilters?.user_role || "all").trim().toUpperCase();
  if (Array.isArray(sections.user) && userRoleFilter !== "ALL") {
    sections.user = sections.user.filter((row) => String(row.role || "").trim().toUpperCase() === userRoleFilter);
  }
  if (Array.isArray(sections.item)) {
    sections.item = applyItemAnalyticsFilters(sections.item);
  }
  const summary = isPlainObject(payload.summary) ? { ...payload.summary } : {};
  if (Object.prototype.hasOwnProperty.call(summary, "total_items")) {
    summary.total_items = Array.isArray(sections.item) ? sections.item.length : 0;
  }
  if (Object.prototype.hasOwnProperty.call(summary, "total_users")) {
    summary.total_users = Array.isArray(sections.user)
      ? sections.user.reduce((acc, row) => acc + Number(row.user_count || 0), 0)
      : 0;
  }
  return {
    ...payload,
    sections,
    summary,
  };
}

function analyticsToExportRows(analyticsResult) {
  const sections = analyticsResult?.sections || {};
  const rows = [];
  for (const [sectionName, sectionRows] of Object.entries(sections)) {
    for (const row of sectionRows || []) {
      rows.push({ analytics: sectionName, ...row });
    }
  }
  return rows;
}

function exportRowsAsCsv(rows, fileName) {
  const sourceRows = rows.length > 0 ? rows : [{ message: "No data" }];
  const columns = Object.keys(sourceRows[0]);
  const escapeValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.map(escapeValue).join(",")];
  for (const row of sourceRows) {
    lines.push(columns.map((column) => escapeValue(row[column])).join(","));
  }
  const csvText = `\uFEFF${lines.join("\n")}`;
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatAnalyticsSummaryLabel(key) {
  const value = String(key || "").trim();
  const predefined = {
    total_users: "Total Users",
    total_items: "Total Items",
    total_transfers: "Total Transfers",
    time_group_by: "Grouped By",
  };
  if (predefined[value]) {
    return predefined[value];
  }
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function analyticsView() {
  const labels = state.labels.analytics;
  if (!canAccessAnalytics()) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }

  const filters = state.analyticsFilters;
  const summary = state.analytics?.summary || {};
  const sections = state.analytics?.sections || {};
  const analyticsSections = [
    { key: "filters", label: labels.analyticsType || "Filters" },
    { key: "summary", label: labels.summary || "Summary" },
    { key: "user", label: "User Analytics" },
    { key: "item", label: "Item Analytics" },
    { key: "delivery", label: "Delivery Analytics" },
    { key: "time", label: "Time Analytics" },
  ];
  const analyticsSectionKeys = new Set(analyticsSections.map((entry) => entry.key));
  const selectedAnalyticsSection = analyticsSectionKeys.has(state.analyticsSection) ? state.analyticsSection : "filters";
  state.analyticsSection = selectedAnalyticsSection;
  const isAnalyticsSection = (key) => selectedAnalyticsSection === key;
  const itemStatusOptions = Array.from(new Set((state.items || []).map((item) => String(item.status || "").trim().toUpperCase()).filter(Boolean))).sort();

  const summaryEntries = Object.entries(summary)
    .map(
      ([key, value]) => `
        <article class="analytics-summary-card">
          <p class="analytics-summary-card__label">${escapeHtml(formatAnalyticsSummaryLabel(key))}</p>
          <strong class="analytics-summary-card__value">${escapeHtml(value)}</strong>
        </article>
      `,
    )
    .join("");

  return `
    <div class="view-stack">
    <div class="task-box super-admin-submenu-shell">
      <div class="super-admin-submenu" role="tablist" aria-label="Analytics Sections">
        ${analyticsSections
          .map(
            (entry) => `
              <button
                type="button"
                class="super-admin-submenu-btn ${isAnalyticsSection(entry.key) ? "is-active" : ""}"
                data-analytics-section="${escapeHtml(entry.key)}"
              >
                ${escapeHtml(entry.label)}
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
    <div class="task-box analytics-filter-shell" style="display:${isAnalyticsSection("filters") ? "block" : "none"};">
    <form id="analytics-filter-form" class="grid analytics-filter-form">
      <div class="analytics-section-head analytics-filter-head">
        <div>
          <h3>${escapeHtml(labels.analyticsType)}</h3>
          <p class="muted analytics-section-copy">Tune the dataset, compare periods, and export the current view</p>
        </div>
        <span class="analytics-section-count">${escapeHtml(filters.group_by || "month")}</span>
      </div>
      <label class="analytics-filter-field">${escapeHtml(labels.analyticsType)}
        <select name="analytics_type">
          <option value="all" ${filters.analytics_type === "all" ? "selected" : ""}>all</option>
          <option value="user" ${filters.analytics_type === "user" ? "selected" : ""}>user</option>
          <option value="item" ${filters.analytics_type === "item" ? "selected" : ""}>item</option>
          <option value="delivery" ${filters.analytics_type === "delivery" ? "selected" : ""}>delivery</option>
          <option value="year" ${filters.analytics_type === "year" ? "selected" : ""}>year/month/date</option>
        </select>
      </label>
      <label class="analytics-filter-field">${escapeHtml(labels.groupBy)}
        <select name="group_by">
          <option value="year" ${filters.group_by === "year" ? "selected" : ""}>year</option>
          <option value="month" ${filters.group_by === "month" ? "selected" : ""}>month</option>
          <option value="date" ${filters.group_by === "date" ? "selected" : ""}>date</option>
        </select>
      </label>
      <label class="analytics-filter-field">${escapeHtml(labels.viewMode || "View Mode")}
        <select name="view_mode">
          <option value="simple" ${filters.view_mode === "simple" ? "selected" : ""}>${escapeHtml(labels.viewModeSimple || "Simple")}</option>
          <option value="detailed" ${filters.view_mode === "detailed" ? "selected" : ""}>${escapeHtml(labels.viewModeDetailed || "Detailed")}</option>
        </select>
      </label>
      <label class="analytics-filter-field">${escapeHtml(labels.rowLimit || "Rows")}
        <select name="row_limit">
          <option value="25" ${String(filters.row_limit || "") === "25" ? "selected" : ""}>25</option>
          <option value="50" ${String(filters.row_limit || "50") === "50" ? "selected" : ""}>50</option>
          <option value="100" ${String(filters.row_limit || "") === "100" ? "selected" : ""}>100</option>
          <option value="all" ${String(filters.row_limit || "") === "all" ? "selected" : ""}>${escapeHtml(labels.rowLimitAll || "All")}</option>
        </select>
      </label>
      <label class="analytics-filter-field">${escapeHtml(labels.startDate)}<input type="date" name="start_date" value="${escapeHtml(filters.start_date || "")}" /></label>
      <label class="analytics-filter-field">${escapeHtml(labels.endDate)}<input type="date" name="end_date" value="${escapeHtml(filters.end_date || "")}" /></label>
      <label class="analytics-filter-field">${escapeHtml(labels.userFilter)}<input name="user_id" value="${escapeHtml(filters.user_id || "")}" /></label>
      <label class="analytics-filter-field">${escapeHtml(labels.itemFilter)}<input name="item_id" value="${escapeHtml(filters.item_id || "")}" /></label>
      <label class="analytics-filter-field">${escapeHtml(labels.deliveryFilter)}<input name="delivery_user_id" value="${escapeHtml(filters.delivery_user_id || "")}" /></label>
      <label class="analytics-filter-field">${escapeHtml(labels.itemStatusFilter || "Item Status")}
        <select name="item_status">
          <option value="all" ${String(filters.item_status || "all").toLowerCase() === "all" ? "selected" : ""}>${escapeHtml(labels.all || "All")}</option>
          ${itemStatusOptions.map((status) => `<option value="${escapeHtml(status)}" ${String(filters.item_status || "").toUpperCase() === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
        </select>
      </label>
      <label class="analytics-filter-field">${escapeHtml(labels.itemFillStateFilter || "Fill State")}
        <select name="item_fill_state">
          <option value="all" ${String(filters.item_fill_state || "all").toLowerCase() === "all" ? "selected" : ""}>${escapeHtml(labels.all || "All")}</option>
          <option value="FULL" ${String(filters.item_fill_state || "").toUpperCase() === "FULL" ? "selected" : ""}>FULL</option>
          <option value="EMPTY" ${String(filters.item_fill_state || "").toUpperCase() === "EMPTY" ? "selected" : ""}>EMPTY</option>
        </select>
      </label>
      <label class="analytics-filter-field">${escapeHtml(labels.itemWarningFilter || "Warning")}
        <select name="item_warning">
          <option value="all" ${String(filters.item_warning || "all").toLowerCase() === "all" ? "selected" : ""}>${escapeHtml(labels.all || "All")}</option>
          <option value="warning" ${String(filters.item_warning || "").toLowerCase() === "warning" ? "selected" : ""}>${escapeHtml(labels.warningOnly || "Warning Only")}</option>
          <option value="clear" ${String(filters.item_warning || "").toLowerCase() === "clear" ? "selected" : ""}>${escapeHtml(labels.clearOnly || "Clear Only")}</option>
        </select>
      </label>
      <div class="row analytics-filter-actions">
        <button type="submit" class="analytics-filter-apply">${escapeHtml(labels.apply)}</button>
        <button id="analytics-export-btn" type="button" class="analytics-filter-export">${escapeHtml(labels.exportExcel)}</button>
      </div>
    </form>
    </div>
    <div style="display:${isAnalyticsSection("summary") ? "block" : "none"};">${summaryEntries ? `<div class="task-box analytics-summary-shell"><h3>${escapeHtml(labels.summary)}</h3><div class="analytics-summary-grid">${summaryEntries}</div></div>` : `<div class="task-box analytics-summary-shell"><h3>${escapeHtml(labels.summary || "Summary")}</h3><p class="muted">No summary data available for current filters</p></div>`}</div>
    <div style="display:${isAnalyticsSection("user") ? "block" : "none"};">${analyticsRowsTable("User Analytics", sections.user || [])}</div>
    <div style="display:${isAnalyticsSection("item") ? "block" : "none"};">${analyticsRowsTable("Item Analytics", sections.item || [])}</div>
    <div style="display:${isAnalyticsSection("delivery") ? "block" : "none"};">${analyticsRowsTable("Delivery Analytics", sections.delivery || [])}</div>
    <div style="display:${isAnalyticsSection("time") ? "block" : "none"};">${analyticsRowsTable("Time Analytics", sections.time || [])}</div>
    </div>
  `;
}

function profileView() {
  const labels = state.labels.profile;
  const profile = state.profile || state.user;
  if (!profile) {
    return `<p class="muted">${escapeHtml(state.labels.common.loading)}</p>`;
  }

  return `
    <form id="profile-form" class="grid">
      <label>${escapeHtml(labels.fullName)}<input name="full_name" required minlength="2" maxlength="120" value="${escapeHtml(profile.full_name || "")}" /></label>
      <label>${escapeHtml(labels.email)}<input name="email" type="email" required value="${escapeHtml(profile.email || "")}" /></label>
      <label>${escapeHtml(labels.userId)}<input disabled value="${escapeHtml(profile.user_code || "-")}" /></label>
      <label>${escapeHtml(labels.role)}<input disabled value="${escapeHtml(profile.role || "")}" /></label>
      <label>${escapeHtml(labels.createdAt)}<input disabled value="${escapeHtml(profile.created_at || "-")}" /></label>
      <label>${escapeHtml(labels.lastLogin)}<input disabled value="${escapeHtml(profile.last_login_at || "-")}" /></label>
      <label>${escapeHtml(labels.currentPassword)}<input id="profile-current-password" name="current_password" type="password" required /></label>
      <label>${escapeHtml(labels.newPassword)}<input id="profile-new-password" name="new_password" type="password" data-strength-input="profile-password" /></label>
      <p class="muted" data-strength-meter="profile-password">Password strength:</p>
      <p class="muted">${escapeHtml(labels.securityKeysHint || "Set all 3 security keys to update account recovery")}</p>
      <label>${escapeHtml(labels.securityKey1 || state.labels.login.securityKey1)}<input name="security_key_1" type="password" maxlength="120" /></label>
      <label>${escapeHtml(labels.securityKey2 || state.labels.login.securityKey2)}<input name="security_key_2" type="password" maxlength="120" /></label>
      <label>${escapeHtml(labels.securityKey3 || state.labels.login.securityKey3)}<input name="security_key_3" type="password" maxlength="120" /></label>
      <button type="submit">${escapeHtml(labels.save)}</button>
    </form>
  `;
}

function adminPasswordResetView() {
  const labels = state.labels.adminPasswordReset;
  if (!canAccessAdminPages()) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }
  if (state.user?.role === "SUPER_ADMIN") {
    return `<p class="muted">${escapeHtml("Super Admin password reset is available only in Profile page")}</p>`;
  }

  return `
    <form id="admin-password-reset-form" class="grid">
      <label>${escapeHtml(labels.currentPassword)}<input name="current_password" type="password" required /></label>
      <label>${escapeHtml(labels.newPassword)}<input name="new_password" type="password" required minlength="8" maxlength="128" data-strength-input="admin-reset-password" /></label>
      <p class="muted" data-strength-meter="admin-reset-password">Password strength:</p>
      <label>${escapeHtml(labels.confirmPassword)}<input name="confirm_password" type="password" required minlength="8" maxlength="128" /></label>
      <p class="muted">${escapeHtml(labels.passwordRule)}</p>
      <button type="submit">${escapeHtml(labels.save)}</button>
    </form>
  `;
}

function backupsView() {
  const labels = state.labels.backups;
  if (!canAccessBackups()) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }

  const backups = Array.isArray(state.backups) ? state.backups : [];
  const userOptions = (state.users || [])
    .filter((user) => String(user.role || "").trim().toUpperCase() !== "SUPER_ADMIN")
    .map(
      (user) =>
        `<option value="${escapeHtml(user.id)}">${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)} (${escapeHtml(user.role)})</option>`
    )
    .join("");
  const backupOptions = backups
    .map(
      (entry) => `<option value="${escapeHtml(entry.file_name)}">${escapeHtml(entry.file_name)} | ${escapeHtml(entry.backup_kind)} | ${escapeHtml(entry.scope)}</option>`
    )
    .join("");
  const rows = backups.length
    ? backups
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(entry.file_name || "-")}</td>
              <td>${escapeHtml(entry.backup_kind || "-")}</td>
              <td>${escapeHtml(entry.scope || "-")}</td>
              <td>${escapeHtml(entry.generated_at || "-")}</td>
              <td>${escapeHtml(entry.generated_by || "-")}</td>
              <td>${escapeHtml(entry.total_records ?? 0)}</td>
              <td>${escapeHtml(formatFileSize(entry.size_bytes))}</td>
              <td><button type="button" data-download-backup="${escapeHtml(entry.file_name)}">${escapeHtml(labels.download)}</button></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="8">${escapeHtml(labels.noBackups)}</td></tr>`;

  return `
    <div class="view-stack">
      <div class="task-box backups-shell">
        <h3>${escapeHtml(labels.exportTitle)}</h3>
        <p class="muted">${escapeHtml(labels.exportHint)}</p>
        <div class="backups-export-grid">
          <form id="backup-monthly-form" class="grid backup-card backup-card-monthly">
            <h4>${escapeHtml(labels.monthlyTitle)}</h4>
            <p class="muted">${escapeHtml(labels.monthlyHint)}</p>
            <button type="submit">${escapeHtml(labels.createMonthly)}</button>
          </form>
          <form id="backup-annual-form" class="grid backup-card backup-card-annual">
            <h4>${escapeHtml(labels.annualTitle)}</h4>
            <p class="muted">${escapeHtml(labels.annualHint)}</p>
            <button type="submit">${escapeHtml(labels.createAnnual)}</button>
          </form>
          <form id="backup-user-form" class="grid backup-card backup-card-user">
            <h4>${escapeHtml(labels.userTitle)}</h4>
            <label>${escapeHtml(labels.targetUser)}
              <select name="target_user_id" required>${userOptions}</select>
            </label>
            <button type="submit">${escapeHtml(labels.createUserBackup)}</button>
          </form>
        </div>
        ${canAccessSuperAdminPage()
          ? `
            <form id="backup-full-form" class="grid backup-card backup-card-full">
              <h4>${escapeHtml(labels.fullTitle)}</h4>
              <p class="muted">${escapeHtml(labels.fullHint)}</p>
              <button type="submit">${escapeHtml(labels.createFull)}</button>
            </form>
          `
          : ""}
      </div>

      <div class="task-box">
        <h3>${escapeHtml(labels.availableTitle)}</h3>
        <p class="muted">${escapeHtml(labels.availableHint)}</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.fileName)}</th>
                <th>${escapeHtml(labels.backupKind)}</th>
                <th>${escapeHtml(labels.scope)}</th>
                <th>${escapeHtml(labels.generatedAt)}</th>
                <th>${escapeHtml(labels.generatedBy)}</th>
                <th>${escapeHtml(labels.records)}</th>
                <th>${escapeHtml(labels.fileSize)}</th>
                <th>${escapeHtml(labels.download)}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>

      ${canAccessSuperAdminPage()
        ? `
          <div class="task-box backups-shell">
            <form id="backup-import-form" class="grid backup-card backup-card-import">
              <h3>${escapeHtml(labels.importTitle)}</h3>
              <p class="muted">${escapeHtml(labels.importHint)}</p>
              <label>${escapeHtml(labels.importMode)}
                <select name="import_mode" required>
                  <option value="MERGE">${escapeHtml(labels.importMerge)}</option>
                  <option value="REPLACE">${escapeHtml(labels.importReplace)}</option>
                </select>
              </label>
              <label>${escapeHtml(labels.existingBackup)}
                <select name="file_name">
                  <option value="">${escapeHtml(labels.noneSelected)}</option>
                  ${backupOptions}
                </select>
              </label>
              <label>${escapeHtml(labels.uploadFile)}<input name="backup_file" type="file" accept="application/json,.json" /></label>
              <p class="error">${escapeHtml(labels.importWarning)}</p>
              <button type="submit">${escapeHtml(labels.importBackup)}</button>
            </form>
          </div>
        `
        : ""}
    </div>
  `;
}

function superAdminView() {
  const labels = state.labels.superAdmin;
  const companySetupLabels = state.labels.companySetup || {};
  if (!canAccessSuperAdminPage()) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }

  const stats = state.superAdminStats || {};
  const endpointDiagnostics = [
    {
      name: companySetupLabels.sectionTitle || "Company Setup",
      available: state.apiAvailability.companySetup !== false,
      missingText: companySetupLabels.endpointMissing || "Company setup endpoint is not available in current backend",
    },
    {
      name: state.labels.analytics?.sectionTitle || "Analytics",
      available: state.apiAvailability.analytics !== false,
      missingText: state.labels.analytics?.endpointMissing || "Analytics endpoint is not available in current backend",
    },
    {
      name: state.labels.roleUpdate?.sectionTitle || "Role Management",
      available: state.apiAvailability.updateRole !== false,
      missingText: state.labels.roleUpdate?.endpointMissing || "Role update endpoint is not available in current backend",
    },
  ];
  const unavailableEndpointRows = endpointDiagnostics
    .filter((entry) => !entry.available)
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.name)}</td>
          <td class="error">${escapeHtml(labels.unavailableStatus || "Unavailable")}</td>
          <td>${escapeHtml(entry.missingText)}</td>
        </tr>
      `,
    )
    .join("");
  const userOptions = (state.users || [])
    .filter((user) => (user.role || "").toUpperCase() !== "SUPER_ADMIN")
    .map(
      (user) =>
        `<option value="${escapeHtml(user.id)}">${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)} (${escapeHtml(user.role)})</option>`
    )
    .join("");
  const itemOptions = (state.items || [])
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.item_code || "-")} - ${escapeHtml(item.title || "-")}</option>`)
    .join("");
  const superAdminSections = [
    { key: "dc-books", label: labels.dcBooksTitle || "DC Books" },
    { key: "category-rules", label: labels.categoryRulesTitle || "Category Rules" },
    { key: "volume-units", label: labels.volumeUnitsTitle || "Volume Units" },
    { key: "custom-ids", label: labels.customItemIdsTitle || "Custom Item IDs" },
    { key: "overview", label: labels.stats || "Overview" },
    { key: "delete-item", label: labels.deleteItemTitle || "Delete Item" },
    { key: "delete-user", label: labels.deleteUserTitle || "Delete User" },
    { key: "reset-table", label: labels.resetTableTitle || "Reset Table" },
    { key: "clear-all", label: labels.clearAllTitle || "Clear All" },
  ];
  const sectionKeys = new Set(superAdminSections.map((entry) => entry.key));
  const selectedSection = sectionKeys.has(state.superAdminSection) ? state.superAdminSection : "overview";
  state.superAdminSection = selectedSection;
  const isSection = (sectionKey) => selectedSection === sectionKey;

  return `
    <div class="view-stack">

      <div class="task-box super-admin-submenu-shell">
        <div class="super-admin-submenu" role="tablist" aria-label="Super Admin Sections">
          ${superAdminSections
            .map(
              (entry) => `<button type="button" data-super-admin-section="${escapeHtml(entry.key)}" class="super-admin-submenu-btn ${isSection(entry.key) ? "is-active" : ""}" aria-pressed="${isSection(entry.key) ? "true" : "false"}">${escapeHtml(entry.label)}</button>`,
            )
            .join("")}
        </div>
      </div>

      <div class="task-box" style="display:${isSection("overview") ? "" : "none"}">
        <h3>${escapeHtml(labels.stats)}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.users)}</th>
                <th>${escapeHtml(labels.items)}</th>
                <th>${escapeHtml(labels.customItemIds || "Custom IDs")}</th>
                <th>${escapeHtml(labels.dcBooks || "DC Books")}</th>
                <th>${escapeHtml(labels.transitionProcesses || "Transition Processes")}</th>
                <th>${escapeHtml(labels.itemTransfers)}</th>
                <th>${escapeHtml(labels.customerOrders)}</th>
                <th>${escapeHtml(labels.notifications)}</th>
                <th>${escapeHtml(labels.sessions)}</th>
                <th>${escapeHtml(labels.navigationEvents)}</th>
                <th>${escapeHtml(labels.loginControls)}</th>
                <th>${escapeHtml(labels.auditLogs)}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(stats.users ?? 0)}</td>
                <td>${escapeHtml(stats.items ?? 0)}</td>
                <td>${escapeHtml(stats.custom_item_ids ?? 0)}</td>
                <td>${escapeHtml(stats.dc_books ?? 0)}</td>
                <td>${escapeHtml(stats.transition_processes ?? 0)}</td>
                <td>${escapeHtml(stats.item_transfers ?? 0)}</td>
                <td>${escapeHtml(stats.customer_orders ?? 0)}</td>
                <td>${escapeHtml(stats.notifications ?? 0)}</td>
                <td>${escapeHtml(stats.user_sessions ?? 0)}</td>
                <td>${escapeHtml(stats.navigation_events ?? 0)}</td>
                <td>${escapeHtml(stats.login_system_controls ?? 0)}</td>
                <td>${escapeHtml(stats.audit_logs ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button id="super-admin-refresh" type="button">${escapeHtml(labels.refresh)}</button>
      </div>

      <div class="task-box" style="display:${isSection("overview") ? "" : "none"}">
        <h3>${escapeHtml(labels.endpointDiagnosticsTitle || "Endpoint Diagnostics")}</h3>
        <p class="muted">${escapeHtml(labels.endpointDiagnosticsSubtitle || "Optional features that are missing in the current backend build")}</p>
        ${
          unavailableEndpointRows
            ? `
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>${escapeHtml(labels.endpointName || "Feature")}</th>
                      <th>${escapeHtml(labels.endpointStatus || "Status")}</th>
                      <th>${escapeHtml(labels.endpointMessage || "Message")}</th>
                    </tr>
                  </thead>
                  <tbody>${unavailableEndpointRows}</tbody>
                </table>
              </div>
            `
            : `<p class="muted">${escapeHtml(labels.allOptionalEndpointsAvailable || "All optional endpoints are available")}</p>`
        }
      </div>
      <div class="task-box" style="display:${isSection("delete-item") ? "" : "none"}">
        <form id="super-admin-delete-item-form" class="grid">
          <h3>${escapeHtml(labels.deleteItemTitle)}</h3>
          <label>${escapeHtml(labels.itemId)}<input name="item_id" required /></label>
          <button type="submit">${escapeHtml(labels.deleteItem)}</button>
        </form>
      </div>

      <div class="task-box" style="display:${isSection("delete-user") ? "" : "none"}">
        <form id="super-admin-delete-user-form" class="grid">
          <h3>${escapeHtml(labels.deleteUserTitle)}</h3>
          <label>${escapeHtml(labels.userId)}<input name="user_id" required /></label>
          <button type="submit">${escapeHtml(labels.deleteUser)}</button>
        </form>
      </div>

      <div class="task-box" style="display:${isSection("reset-table") ? "" : "none"}">
        <form id="super-admin-reset-table-form" class="grid">
          <h3>${escapeHtml(labels.resetTableTitle)}</h3>
          <label>${escapeHtml(labels.tableName)}
            <select name="table_name" required>
              <option value="users">${escapeHtml(labels.tableUsers)}</option>
              <option value="items">${escapeHtml(labels.tableItems)}</option>
              <option value="custom_item_ids">${escapeHtml(labels.tableCustomItemIds || "custom_item_ids")}</option>
              <option value="dc_books">${escapeHtml(labels.tableDcBooks || "dc_books")}</option>
              <option value="transition_processes">${escapeHtml(labels.tableTransitionProcesses || "transition_processes")}</option>
              <option value="item_transfers">${escapeHtml(labels.tableItemTransfers)}</option>
              <option value="customer_orders">${escapeHtml(labels.tableCustomerOrders)}</option>
              <option value="notifications">${escapeHtml(labels.tableNotifications)}</option>
              <option value="user_sessions">${escapeHtml(labels.tableSessions)}</option>
              <option value="navigation_events">${escapeHtml(labels.tableNavigation)}</option>
              <option value="login_system_controls">${escapeHtml(labels.tableLoginControls)}</option>
              <option value="audit_logs">${escapeHtml(labels.tableAuditLogs)}</option>
            </select>
          </label>
          <button type="submit">${escapeHtml(labels.resetTable)}</button>
        </form>
      </div>

      <div class="task-box" style="display:${isSection("clear-all") ? "" : "none"}">
        <form id="super-admin-clear-all-form" class="grid">
          <h3>${escapeHtml(labels.clearAllTitle)}</h3>
          <p class="error">${escapeHtml(labels.clearAllWarning)}</p>
          <label>${escapeHtml(labels.reason)}<input name="reason" required minlength="3" maxlength="500" /></label>
          <label>${escapeHtml(labels.confirmText)}<input name="confirm_text" required /></label>
          <button type="submit">${escapeHtml(labels.clearAll)}</button>
        </form>
      </div>

      <div class="task-box" style="display:${isSection("category-rules") ? "" : "none"}">
        <h3>${escapeHtml(labels.categoryRulesTitle)}</h3>
        <p class="muted">${escapeHtml(labels.categoryRulesSubtitle)}</p>
        <form id="super-admin-category-form" class="grid">
          <input type="hidden" id="category-edit-key" name="category_key" value="" />
          <p class="form-section-title">${escapeHtml(state.labels.formSections?.basicInfo || "Basic Info")}</p>
          <label>${escapeHtml(labels.itemType || "Category Type")}
            <select id="category-type-select" name="category_type" required>
              ${renderItemTypeOptions("CONTAINER")}
            </select>
          </label>
          <label>${escapeHtml(labels.categoryName)}
            <input id="category-name-input" name="category_name" list="category-name-options" required maxlength="200" placeholder="e.g., 2ft x 2ft Box" />
            <datalist id="category-name-options"></datalist>
          </label>
          <label>${escapeHtml(labels.codePrefix)}<input id="category-prefix-input" name="code_prefix" required maxlength="50" placeholder="e.g., BX2" /></label>
          <label>${escapeHtml(labels.codePrefixes)}<textarea id="category-prefixes-input" name="prefixes" placeholder="e.g., BX2,BOX2,SMALLBOX" style="height: 80px;"></textarea></label>
          <p class="form-section-title">${escapeHtml(state.labels.formSections?.rangeStatus || "Range & Status")}</p>
          <label>${escapeHtml(labels.range || "Range")}
            <div class="row">
              <input id="category-range-start-input" name="range_start" type="number" min="0" max="999999" placeholder="${escapeHtml(labels.rangeStart || "Start (optional)")}" aria-label="${escapeHtml(labels.rangeStart || "Range Start")}" />
              <input id="category-range-end-input" name="range_end" type="number" min="0" max="999999" placeholder="${escapeHtml(labels.rangeEnd || "End (optional)")}" aria-label="${escapeHtml(labels.rangeEnd || "Range End")}" />
            </div>
          </label>
          <label>
            ${escapeHtml(labels.isActive)}
            <div class="row">
              <input id="category-is-active-input" name="is_active" type="checkbox" checked aria-label="${escapeHtml(labels.isActive)}" />
              <span id="category-is-active-text" class="muted">${escapeHtml(state.labels.common.yes || "Yes")}</span>
            </div>
          </label>
          <button type="submit">${escapeHtml(labels.addCategory)}</button>
        </form>

        <div class="table-wrap">
          <h4>${escapeHtml(labels.existingCategories)}</h4>
          <table id="super-admin-categories-table">
            <thead>
              <tr>
                <th>${escapeHtml(labels.itemType || "Type")}</th>
                <th>${escapeHtml(labels.categoryName)}</th>
                <th>${escapeHtml(labels.activePrefix)}</th>
                <th>${escapeHtml(labels.prefixCount)}</th>
                <th>${escapeHtml(labels.range)}</th>
                <th>${escapeHtml(labels.isActive)}</th>
                <th>${escapeHtml(labels.actions)}</th>
              </tr>
            </thead>
            <tbody id="super-admin-categories-tbody">
              <tr><td colspan="7" class="muted">${escapeHtml(labels.noCategoryRules)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="task-box" style="display:${isSection("custom-ids") ? "" : "none"}">
        <h3>${escapeHtml(labels.customItemIdsTitle || "Custom Item IDs")}</h3>
        <p class="muted">${escapeHtml(labels.customItemIdsSubtitle || "Map a unique custom ID to each item")}</p>
        <form id="super-admin-custom-id-form" class="grid">
          <label>${escapeHtml(labels.item || "Item")}
            <select name="item_id" required>
              <option value="">Select Item</option>
              ${itemOptions}
            </select>
          </label>
          <label>${escapeHtml(labels.customId || "Custom ID")}
            <input name="custom_id" required minlength="2" maxlength="50" placeholder="A-Z, 0-9, -, _" />
          </label>
          <button type="submit">${escapeHtml(labels.saveCustomId || "Save Mapping")}</button>
        </form>
        <div class="table-wrap">
          <h4>${escapeHtml(labels.existingCustomIds || "Existing Custom ID Mappings")}</h4>
          <label style="max-width:360px; margin-bottom: var(--sp-2); display:block;">
            ${escapeHtml(labels.searchCustomIds || "Search")}
            <input id="super-admin-custom-id-filter" type="text" value="${escapeHtml(state.superAdminCustomIdFilter || "")}" placeholder="Item ID, code, title, custom ID" />
          </label>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.itemId || "Item ID")}</th>
                <th>${escapeHtml(labels.code || "Code")}</th>
                <th>${escapeHtml(labels.title || "Title")}</th>
                <th>${escapeHtml(labels.customId || "Custom ID")}</th>
                <th>${escapeHtml(labels.updated || "Updated")}</th>
                <th>${escapeHtml(labels.actions || "Actions")}</th>
              </tr>
            </thead>
            <tbody id="super-admin-custom-ids-tbody">
              <tr><td colspan="6" class="muted">${escapeHtml(labels.noCustomIds || "No custom ID mappings found")}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="task-box" style="display:${isSection("volume-units") ? "" : "none"}">
        <h3>${escapeHtml(labels.volumeUnitsTitle || "Volume Units")}</h3>
        <p class="muted">${escapeHtml(labels.volumeUnitsSubtitle || "Manage cylinder volume unit options")}</p>
        <form id="super-admin-volume-unit-form" class="grid">
          <label>${escapeHtml(labels.volumeUnitName || "Volume Unit")}
            <input name="unit_name" required minlength="2" maxlength="40" placeholder="e.g., MILLILITERS" />
          </label>
          <button type="submit">${escapeHtml(labels.addVolumeUnit || "Add Volume Unit")}</button>
        </form>
        <div class="table-wrap">
          <h4>${escapeHtml(labels.existingVolumeUnits || "Existing Volume Units")}</h4>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.volumeUnitName || "Volume Unit")}</th>
                <th>${escapeHtml(labels.actions || "Actions")}</th>
              </tr>
            </thead>
            <tbody id="super-admin-volume-units-tbody">
              <tr><td colspan="2" class="muted">${escapeHtml(labels.noVolumeUnits || "No volume units found")}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="task-box" style="display:${isSection("dc-books") ? "" : "none"}">
        <h3>${escapeHtml(labels.dcBooksTitle || "DC Books")}</h3>
        <p class="muted">${escapeHtml(labels.dcBooksSubtitle || "Create physical DC books and set their number range")}</p>
        <form id="super-admin-dc-book-form" class="grid">
          <p class="form-section-title">${escapeHtml(state.labels.formSections?.bookSetup || "Book Setup")}</p>
          <label>${escapeHtml(labels.dcBookId || "Book ID")}<input name="book_id" required maxlength="60" placeholder="e.g., 1 or APR-BOOK-1" /></label>
          <label>${escapeHtml(labels.range || "Range")}
            <div class="row">
              <input name="range_start" type="number" min="0" value="0" required aria-label="${escapeHtml(labels.dcRangeStart || "Range Start")}" />
              <input name="range_end" type="number" min="0" value="100" required aria-label="${escapeHtml(labels.dcRangeEnd || "Range End")}" />
            </div>
          </label>
          <button type="submit">${escapeHtml(labels.createDcBook || "Create DC Book")}</button>
        </form>
        <div class="table-wrap">
          <h4>${escapeHtml(labels.existingDcBooks || "Existing DC Books")}</h4>
          <div class="row" style="gap: var(--sp-2); margin-bottom: var(--sp-2); align-items: end; flex-wrap: wrap;">
            <label style="min-width: 220px; flex: 1 1 220px;">
              ${escapeHtml(labels.search || "Search")}
              <input id="super-admin-dc-book-filter" type="text" value="${escapeHtml(state.superAdminDcBookFilter || "")}" placeholder="Book ID" />
            </label>
            <label style="min-width: 180px;">
              ${escapeHtml(labels.status || "Status")}
              <select id="super-admin-dc-book-active-filter">
                <option value="all" ${String(state.superAdminDcBookActiveFilter || "all").toLowerCase() === "all" ? "selected" : ""}>All</option>
                <option value="active" ${String(state.superAdminDcBookActiveFilter || "all").toLowerCase() === "active" ? "selected" : ""}>Active</option>
                <option value="inactive" ${String(state.superAdminDcBookActiveFilter || "all").toLowerCase() === "inactive" ? "selected" : ""}>Inactive</option>
              </select>
            </label>
          </div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.dcBookId || "Book ID")}</th>
                <th>${escapeHtml(labels.range || "Range")}</th>
                <th>${escapeHtml(labels.dcNextNumber || "Next DC No")}</th>
                <th>${escapeHtml(labels.remaining || "Remaining")}</th>
                <th>${escapeHtml(labels.isActive || "Active")}</th>
                <th>${escapeHtml(labels.actions || "Actions")}</th>
              </tr>
            </thead>
            <tbody id="super-admin-dc-books-tbody">
              <tr><td colspan="6" class="muted">${escapeHtml(labels.noDcBooks || "No DC books found")}</td></tr>
            </tbody>
          </table>
        </div>
        <div id="super-admin-dc-book-details" class="task-box" style="margin-top: var(--sp-3);">
          <p class="muted">Select a DC book to view analytics and records.</p>
        </div>
      </div>

    </div>
  `;
}

function notificationsView() {
  const labels = state.labels.notifications;
  const canCreate = canManageRequirements();

  const recipientOptions = (state.users || [])
    .filter((user) => user.id !== state.user?.id)
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)} (${escapeHtml(user.role)})</option>`)
    .join("");
  const recipientSelectOptions = recipientOptions || `<option value="">${escapeHtml(labels.noRecipients || "No recipients available")}</option>`;

  const itemOptions = (state.items || [])
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.item_code)} - ${escapeHtml(item.title)}</option>`)
    .join("");

  const composeSection = canCreate
    ? `
      <div class="task-box">
        <form id="notification-requirement-form" class="grid">
          <h3>${escapeHtml(labels.composeTitle)}</h3>
          <label>${escapeHtml(labels.recipient)}
            <select name="to_user_id" required>${recipientSelectOptions}</select>
          </label>
          <label>${escapeHtml(labels.item)}
            <select name="item_id">
              <option value="">-</option>
              ${itemOptions}
            </select>
          </label>
          <label>${escapeHtml(labels.message)}<input name="message" required minlength="3" maxlength="500" /></label>
          <button type="submit">${escapeHtml(labels.send)}</button>
        </form>
      </div>
    `
    : `<p class="muted">${escapeHtml(labels.adminOnly)}</p>`;

  const deliveryFilter = String(state.notificationDeliveryNoFilter || "").trim();
  const searchFilter = String(state.notificationSearchFilter || "").trim().toLowerCase();
  const typeFilter = String(state.notificationTypeFilter || "").trim().toUpperCase();
  const typeOptions = Array.from(new Set((state.notifications || []).map((entry) => String(entry.type || "").trim()).filter(Boolean))).sort();
  const filteredNotifications = (state.notifications || []).filter((entry) => {
    if (deliveryFilter && !String(entry.delivery_no || "").includes(deliveryFilter)) {
      return false;
    }
    if (typeFilter && String(entry.type || "").trim().toUpperCase() !== typeFilter) {
      return false;
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [
      entry.type,
      entry.title,
      entry.from_user_name,
      entry.to_user_name,
      entry.to_role,
      entry.item_code,
      entry.delivery_no,
      entry.created_at
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });

  const rows = filteredNotifications
    .map(
      (entry) => `
        <tr>
          <td>${escapeHtml(entry.type || "-")}</td>
          <td>${escapeHtml(entry.title || "-")}</td>
          <td>${escapeHtml(entry.from_user_name || "-")}</td>
          <td>${escapeHtml(entry.to_user_name || entry.to_role || "-")}</td>
          <td>${escapeHtml(entry.item_code || "-")}</td>
          <td>${escapeHtml(entry.delivery_no || "-")}</td>
          <td>${escapeHtml(entry.created_at || "-")}</td>
          <td>${entry.is_read ? escapeHtml(labels.read) : escapeHtml(labels.unread)}</td>
          <td>${entry.is_read ? "-" : `<button type="button" data-mark-read="${escapeHtml(entry.id)}">${escapeHtml(labels.markRead)}</button>`}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="view-stack">
      ${composeSection}
      <div class="task-box list-scroll-shell">
        <div class="list-scroll-head">
        <div class="row" style="margin-bottom:var(--sp-2)">
          <h3>${escapeHtml(labels.listTitle)}</h3>
          <button type="button" id="notifications-mark-all">${escapeHtml(labels.markAllRead)}</button>
        </div>
        <div class="row" style="margin-bottom:var(--sp-2)">
          <label style="max-width:320px">${escapeHtml(labels.searchLabel || "Search")}
            <input id="notifications-search-filter" type="text" value="${escapeHtml(state.notificationSearchFilter || "")}" placeholder="${escapeHtml(labels.searchPlaceholder || "Title, user, item, delivery")}" />
          </label>
          <label style="max-width:220px">${escapeHtml(labels.typeFilterLabel || labels.type || "Type")}
            <select id="notifications-type-filter">
              <option value="">${escapeHtml(labels.allTypes || "All")}</option>
              ${typeOptions.map((type) => `<option value="${escapeHtml(type)}" ${typeFilter === type.toUpperCase() ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
            </select>
          </label>
          <label style="max-width:320px">${escapeHtml(labels.searchDeliveryNo || "Search Delivery No")}
            <input id="notifications-delivery-no-filter" type="text" value="${escapeHtml(deliveryFilter)}" placeholder="${escapeHtml(labels.searchDeliveryNo || "Search Delivery No")}" />
          </label>
        </div>
        </div>
        <div class="table-wrap list-scroll-content">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.type)}</th>
                <th>${escapeHtml(labels.title)}</th>
                <th>${escapeHtml(labels.from)}</th>
                <th>${escapeHtml(labels.to)}</th>
                <th>${escapeHtml(labels.itemCode)}</th>
                <th>${escapeHtml(labels.deliveryNo || "Delivery No")}</th>
                <th>${escapeHtml(labels.time)}</th>
                <th>${escapeHtml(labels.status)}</th>
                <th>${escapeHtml(labels.markRead)}</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="9" class="muted">${escapeHtml(labels.empty)}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function ordersView() {
  const labels = state.labels.orders;
  if (!canManageOrders()) {
    return `<p class="muted">Forbidden</p>`;
  }

  const editableOrders = (state.orders || []).filter((order) =>
    ["PENDING_ADMIN", "REJECTED"].includes(order.status) &&
    (order.created_by_user_id === state.user?.id || canManageRequirements())
  );
  const editableOptions = [
    `<option value="">${escapeHtml(labels.newOrder)}</option>`,
    ...editableOrders.map(
      (order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.customer_name)} - ${escapeHtml(order.status)}</option>`
    )
  ].join("");

  const itemOptions = (state.items || [])
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.item_code)} - ${escapeHtml(item.title)}</option>`)
    .join("");

  const pendingAdminOrders = (state.orders || []).filter((order) => order.status === "PENDING_ADMIN");
  const pendingAdminOptions = pendingAdminOrders
    .map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.customer_name)} - ${escapeHtml(order.created_by_user_name || "-")}</option>`)
    .join("");
  const pendingAdminSelectOptions = pendingAdminOptions || `<option value="">${escapeHtml(labels.noPendingAdminOrders || "No pending orders")}</option>`;

  const deliveryCandidates = (state.users || []).filter((user) => ["DELIVERY_PARTNER", "EXTERNAL_PARTNER", "ADMIN", "SUPER_ADMIN"].includes(user.role));
  const deliveryOptions = deliveryCandidates
    .map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)} (${escapeHtml(user.role)})</option>`)
    .join("");

  const pendingDeliveryOrders = (state.orders || []).filter((order) => {
    if (order.status !== "PENDING_DELIVERY") {
      return false;
    }
    if (["DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(state.user?.role || "")) {
      return !order.delivery_user_id || order.delivery_user_id === state.user?.id;
    }
    return true;
  });
  const pendingDeliveryOptions = pendingDeliveryOrders
    .map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.customer_name)} - ${escapeHtml(order.item_code || "-")}</option>`)
    .join("");
  const pendingDeliverySelectOptions = pendingDeliveryOptions || `<option value="">${escapeHtml(labels.noPendingDeliveryOrders || "No pending delivery orders")}</option>`;

  const composeSection = canCreateOrders()
    ? `
    <div class="task-box">
      <form id="orders-upsert-form" class="grid">
        <h3>${escapeHtml(labels.placeTitle)}</h3>
        <label>${escapeHtml(labels.orderToUpdate)}
          <select name="order_id">${editableOptions}</select>
        </label>
        <label>${escapeHtml(labels.customerName)}<input name="customer_name" required minlength="2" maxlength="120" /></label>
        <label>${escapeHtml(labels.customerContact)}<input name="customer_contact" maxlength="100" /></label>
        <label>${escapeHtml(labels.item)}
          <select name="item_id">
            <option value="">-</option>
            ${itemOptions}
          </select>
        </label>
        <label>${escapeHtml(labels.quantity)}<input name="quantity" type="number" min="1" max="100000" value="1" required /></label>
        <label>${escapeHtml(labels.notes)}<input name="notes" maxlength="1000" /></label>
        <button type="submit">${escapeHtml(labels.submit)}</button>
      </form>
    </div>
  `
    : "";

  const approvalSection = canApproveOrders()
    ? `
      <div class="task-box">
        <form id="orders-approve-form" class="grid">
          <h3>${escapeHtml(labels.approveTitle)}</h3>
          <label>${escapeHtml(labels.approveOrder)}
            <select name="order_id" required>${pendingAdminSelectOptions}</select>
          </label>
          <label>${escapeHtml(labels.deliveryUser)}
            <select name="delivery_user_id">
              <option value="">${escapeHtml(labels.selectDeliveryUser || "Select delivery user")}</option>
              ${deliveryOptions}
            </select>
          </label>
          <label>${escapeHtml(labels.adminNote)}<input name="admin_note" maxlength="400" /></label>
          <div class="row">
            <button type="submit" data-approve-action="approve">${escapeHtml(labels.approve)}</button>
            <button type="submit" data-approve-action="reject">${escapeHtml(labels.reject)}</button>
          </div>
        </form>
      </div>
    `
    : "";

  const deliverySection = canDeliverOrders()
    ? `
    <div class="task-box">
      <form id="orders-delivery-form" class="grid">
        <h3>${escapeHtml(labels.pendingDeliveryTitle)}</h3>
        <label>${escapeHtml(labels.deliverOrder)}
          <select name="order_id" required>${pendingDeliverySelectOptions}</select>
        </label>
        <label>${escapeHtml(labels.deliveryNote)}<input name="delivery_note" maxlength="500" /></label>
        <button type="submit">${escapeHtml(labels.markDelivered)}</button>
      </form>
    </div>
  `
    : "";

  const deliveryFilter = String(state.orderDeliveryNoFilter || "").trim();
  const searchFilter = String(state.orderSearchFilter || "").trim().toLowerCase();
  const statusFilter = String(state.orderStatusFilter || "").trim().toUpperCase();
  const statusOptions = Array.from(new Set((state.orders || []).map((order) => String(order.status || "").trim()).filter(Boolean))).sort();
  const filteredOrders = (state.orders || []).filter((order) => {
    if (deliveryFilter && !String(order.delivery_no || "").includes(deliveryFilter)) {
      return false;
    }
    if (statusFilter && String(order.status || "").trim().toUpperCase() !== statusFilter) {
      return false;
    }
    if (!searchFilter) {
      return true;
    }
    const haystack = [
      order.customer_name,
      order.item_code,
      order.status,
      order.created_by_user_name,
      order.delivery_user_name,
      order.delivery_no
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return haystack.includes(searchFilter);
  });

  const rows = filteredOrders
    .map(
      (order) => `
        <tr>
          <td>${escapeHtml(order.customer_name || "-")}</td>
          <td>${escapeHtml(order.item_code || "-")}</td>
          <td>${escapeHtml(order.quantity ?? "-")}</td>
          <td>${escapeHtml(order.status || "-")}</td>
          <td>${escapeHtml(order.delivery_no || "-")}</td>
          <td>${escapeHtml(order.created_by_user_name || "-")}</td>
          <td>${escapeHtml(order.delivery_user_name || "-")}</td>
          <td>${escapeHtml(order.created_at || "-")}</td>
          <td>${escapeHtml(order.updated_at || "-")}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="view-stack">
      ${composeSection}
      ${approvalSection}
      ${deliverySection}
      <div class="task-box list-scroll-shell">
        <div class="list-scroll-head">
        <h3>${escapeHtml(labels.allOrders || "All Orders")}</h3>
        <div class="row" style="margin-bottom:var(--sp-2)">
          <label style="max-width:320px">${escapeHtml(labels.searchLabel || "Search")}
            <input id="orders-search-filter" type="text" value="${escapeHtml(state.orderSearchFilter || "")}" placeholder="${escapeHtml(labels.searchPlaceholder || "Customer, item, user, status")}" />
          </label>
          <label style="max-width:220px">${escapeHtml(labels.statusFilterLabel || labels.status || "Status")}
            <select id="orders-status-filter">
              <option value="">${escapeHtml(labels.allStatuses || "All")}</option>
              ${statusOptions.map((status) => `<option value="${escapeHtml(status)}" ${statusFilter === status.toUpperCase() ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
            </select>
          </label>
          <label style="max-width:320px">${escapeHtml(labels.searchDeliveryNo || "Search Delivery No")}
            <input id="orders-delivery-no-filter" type="text" value="${escapeHtml(deliveryFilter)}" placeholder="${escapeHtml(labels.searchDeliveryNo || "Search Delivery No")}" />
          </label>
        </div>
        </div>
        <div class="table-wrap list-scroll-content">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.customerName)}</th>
                <th>${escapeHtml(labels.item)}</th>
                <th>${escapeHtml(labels.quantity)}</th>
                <th>${escapeHtml(labels.status)}</th>
                <th>${escapeHtml(labels.deliveryNo || "Delivery No")}</th>
                <th>${escapeHtml(labels.createdBy)}</th>
                <th>${escapeHtml(labels.deliveryTo)}</th>
                <th>${escapeHtml(labels.createdAt)}</th>
                <th>${escapeHtml(labels.updatedAt)}</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="9" class="muted">${escapeHtml(labels.empty)}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function transitionView() {
  const labels = state.labels.transition;
  if (!canAccessTransition()) {
    return `<p class="muted">${escapeHtml(labels.forbidden)}</p>`;
  }

  const flow = state.transitionFlow;
  const step = Number(flow.step || 1);
  const infoButtonLabel = labels.infoButton || "Info";
  const currentUserRole = String(state.user?.role || "").trim().toUpperCase();
  const transitionAllowedSourcesByRole = {
    SUPER_ADMIN: { TAKING: ["SELF", "EMPLOYEE", "FILLER", "CUSTOMER", "TRANSIT"], GIVING: ["SELF", "TRANSIT"] },
    ADMIN: { TAKING: ["SELF", "EMPLOYEE", "FILLER", "CUSTOMER", "TRANSIT"], GIVING: ["SELF", "TRANSIT"] },
    DELIVERY_PARTNER: { TAKING: ["SELF", "EMPLOYEE", "TRANSIT"], GIVING: ["SELF", "TRANSIT"] },
    EXTERNAL_PARTNER: { TAKING: ["SELF", "EMPLOYEE", "TRANSIT"], GIVING: ["SELF", "TRANSIT"] },
    FILLER: { TAKING: ["SELF", "FILLER", "TRANSIT"], GIVING: ["SELF", "TRANSIT"] },
    CUSTOMER: { TAKING: ["SELF", "CUSTOMER", "TRANSIT"], GIVING: ["SELF", "TRANSIT"] }
  };
  const transitionRoleOwnSource = {
    DELIVERY_PARTNER: "EMPLOYEE",
    EXTERNAL_PARTNER: "EMPLOYEE",
    FILLER: "FILLER",
    CUSTOMER: "CUSTOMER"
  };

  const renderTransitionInfoBlock = (messages) => {
    const entries = (messages || []).map((value) => String(value || "").trim()).filter(Boolean);
    if (entries.length === 0) {
      return "";
    }
    return `
      <div class="transition-info-shell">
        <button type="button" id="transition-info-toggle" class="transition-info-toggle" aria-expanded="${state.transitionInfoOpen ? "true" : "false"}" aria-label="${escapeHtml(infoButtonLabel)}" title="${escapeHtml(infoButtonLabel)}">i</button>
        ${state.transitionInfoOpen
          ? `<div class="transition-info-panel">${entries.map((entry) => `<p class="muted">${escapeHtml(entry)}</p>`).join("")}</div>`
          : ""}
      </div>
    `;
  };

  if (step === 1) {
    return `
      <div class="view-stack transition-shell">
      <form id="transition-step1-form" class="grid transition-form-shell">
        ${renderTransitionInfoBlock([labels.autoNextHint || "Selecting an action will continue automatically"])}
        <p class="form-section-title">${escapeHtml(state.labels.formSections?.chooseAction || labels.action)}</p>
        <div class="transition-action-group" role="radiogroup" aria-label="${escapeHtml(labels.action)}">
          <label class="transition-action-option ${flow.action === "TAKING" ? "active" : ""}">
            <input type="radio" name="action" value="TAKING" ${flow.action === "TAKING" ? "checked" : ""} />
            <span>${escapeHtml(labels.taking)}</span>
          </label>
          <label class="transition-action-option ${flow.action === "GIVING" ? "active" : ""}">
            <input type="radio" name="action" value="GIVING" ${flow.action === "GIVING" ? "checked" : ""} />
            <span>${escapeHtml(labels.giving)}</span>
          </label>
        </div>
      </form>
      </div>
    `;
  }

  if (step === 2) {
    const normalizedRole = (user) => String(user.role || "").trim().toUpperCase();
    const employeeOptions = state.transitionUsers
      .filter((user) => ["SUPER_ADMIN", "ADMIN", "DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(normalizedRole(user)))
      .map(
        (user) =>
          `<option value="${escapeHtml(user.id)}" ${flow.sourceUserId === user.id ? "selected" : ""}>${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)}</option>`
      )
      .join("");
    const fillerOptions = state.transitionUsers
      .filter((user) => normalizedRole(user) === "FILLER")
      .map(
        (user) =>
          `<option value="${escapeHtml(user.id)}" ${flow.sourceUserId === user.id ? "selected" : ""}>${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)}</option>`
      )
      .join("");
    const customerOptions = state.transitionUsers
      .filter((user) => normalizedRole(user) === "CUSTOMER")
      .map(
        (user) =>
          `<option value="${escapeHtml(user.id)}" ${flow.sourceUserId === user.id ? "selected" : ""}>${escapeHtml(user.user_code || "----")} - ${escapeHtml(user.full_name || user.email)}</option>`
      )
      .join("");
    const customerLocationOptions = (state.customerLocations || [])
      .filter((loc) => String(loc.user_id || "").trim() === String(flow.sourceUserId || "").trim())
      .filter((loc) => loc.is_active === undefined || loc.is_active === null || Boolean(loc.is_active))
      .map(
        (loc) =>
          `<option value="${escapeHtml(loc.id)}" ${flow.sourceLocationId === loc.id ? "selected" : ""}>${escapeHtml(loc.location_name || "-")}</option>`
      )
      .join("");
    const activeCompanyLocations = (state.companyLocations || []).filter((loc) => Boolean(loc?.is_active));
    const companyLocationOptions = renderLocationOptions(flow.sourceLocationId, "", {
      blankLabel: labels.selectLocation || "Select location",
      activeOnly: true
    });
    const selectedCustomerLocationsCount = (state.customerLocations || [])
      .filter((loc) => String(loc.user_id || "").trim() === String(flow.sourceUserId || "").trim())
      .filter((loc) => loc.is_active === undefined || loc.is_active === null || Boolean(loc.is_active)).length;
    const currentUserId = String(state.user?.id || "").trim();
    const allowedSourcesForRole = transitionAllowedSourcesByRole[currentUserRole] || { TAKING: ["SELF"], GIVING: ["SELF"] };
    const hasTransitItems = (state.items || []).some(
      (item) =>
        String(item.status || "").trim().toUpperCase() === "IN_TRANSIT"
        && String(item.current_holder_user_id || "").trim() === currentUserId
    );
    if (!hasTransitItems && String(flow.sourceType || "").trim().toUpperCase() === "TRANSIT") {
      state.transitionFlow.sourceType = "";
    }
    const sourceChoiceLabels = {
      SELF: labels.sourceSelf,
      EMPLOYEE: labels.sourceUser,
      FILLER: labels.sourceFiller || "Filler",
      CUSTOMER: labels.sourceCustomer,
      TRANSIT: labels.sourceTransit
    };
    const sourceChoices = (allowedSourcesForRole[flow.action === "GIVING" ? "GIVING" : "TAKING"] || [])
      .filter((sourceValue) => sourceValue !== "TRANSIT" || hasTransitItems)
      .map((sourceValue) => [sourceValue, sourceChoiceLabels[sourceValue] || sourceValue]);

    return `
      <div class="view-stack transition-shell">
      <form id="transition-step2-form" class="grid transition-form-shell">
        ${renderTransitionInfoBlock([labels.autoNextSourceHint || "Selecting a source will continue automatically"])}
        <p class="form-section-title">${escapeHtml(state.labels.formSections?.chooseSource || labels.sourceType)}</p>
        <div class="transition-action-group" role="radiogroup" aria-label="${escapeHtml(labels.sourceType)}">
          ${sourceChoices
            .map(
              ([sourceValue, sourceLabel]) => `
                <label class="transition-action-option ${flow.sourceType === sourceValue ? "active" : ""}">
                  <input type="radio" name="source_type" value="${sourceValue}" ${flow.sourceType === sourceValue ? "checked" : ""} />
                  <span>${escapeHtml(sourceLabel)}</span>
                </label>
              `
            )
            .join("")}
        </div>
        ${flow.sourceType === "SELF" && activeCompanyLocations.length > 1 ? `<label>${escapeHtml(labels.sourceSelfLocationSelect || labels.selectLocation || "Select Location")}<select name="source_location_id" required>${companyLocationOptions}</select></label>` : ""}
        ${flow.sourceType === "EMPLOYEE" ? `<label>${escapeHtml(labels.sourceUserSelect)}<select name="source_user_id" required><option value="">${escapeHtml(labels.selectSourceUser || "Select employee")}</option>${employeeOptions}</select></label>` : ""}
        ${flow.sourceType === "FILLER" ? `<label>${escapeHtml(labels.sourceFillerSelect || "Select Filler")}<select name="source_user_id" required><option value="">${escapeHtml(labels.selectSourceFiller || "Select filler")}</option>${fillerOptions}</select></label>` : ""}
        ${flow.sourceType === "CUSTOMER" ? `<label>${escapeHtml(labels.sourceCustomerSelect || "Select Customer")}<select name="source_user_id" required><option value="">${escapeHtml(labels.selectSourceCustomer || "Select customer")}</option>${customerOptions}</select></label>` : ""}
        ${flow.sourceType === "CUSTOMER" && flow.sourceUserId && selectedCustomerLocationsCount > 1 ? `<label>${escapeHtml(labels.sourceCustomerLocationSelect || "Select Customer Location")}<select name="source_location_id" required><option value="">${escapeHtml(labels.selectSourceCustomerLocation || "Select customer location")}</option>${customerLocationOptions}</select></label>` : ""}
        <div class="row">
          <button type="button" id="transition-back-1">${escapeHtml(labels.back)}</button>
        </div>
      </form>
      </div>
    `;
  }

  if (step === 4) {
    return `
      <div class="view-stack transition-shell">
      <form id="transition-continue-form" class="grid transition-form-shell">
        ${renderTransitionInfoBlock([labels.addAnotherPrompt || "Do you want to add another transition in the same process?"])}
        <p class="form-section-title">${escapeHtml(state.labels.formSections?.chooseAction || labels.action)}</p>
        <p>${escapeHtml(labels.addAnotherPrompt || "Do you want to add another transition in the same process?")}</p>
        <div class="row">
          <button type="button" id="transition-continue-yes">${escapeHtml(state.labels.common?.yes || "Yes")}</button>
          <button type="button" id="transition-continue-no">${escapeHtml(state.labels.common?.no || "No")}</button>
        </div>
      </form>
      </div>
    `;
  }

  const isFiller = state.user?.role === "FILLER";
  const showDcBook = flow.action === "GIVING" && flow.dispatchTargetType !== "USER";
  const dcBookHintText = isFiller
    ? (labels.dcBookHintFiller || "Optional: DC book can be added if needed")
    : (labels.dcBookHint || "Required for GIVING with FULL-state items");
  const dcBookSelect = showDcBook
    ? `
      <label>${escapeHtml(labels.dcBook || "DC Book")}
        <select name="dc_book_id">
          <option value="">${escapeHtml(labels.selectDcBook || "Select available DC book")}</option>
          ${state.transitionDcBooks
            .map(
              (book) =>
                `<option value="${escapeHtml(book.book_id)}" ${flow.dcBookId === book.book_id ? "selected" : ""}>${escapeHtml(book.book_id)} (${escapeHtml(`${book.next_dc_number}-${book.range_end}`)})</option>`
            )
            .join("")}
        </select>
      </label>
    `
    : "";
  const dcLinkSelect = flow.action === "TAKING"
    ? `
      <label>${escapeHtml(labels.linkDc || "Link Existing DC (Optional)")}
        <select name="link_dc_ref">
          <option value="">${escapeHtml(labels.noDcLink || "No link")}</option>
          ${state.transitionDcLinks
            .map(
              (entry) => {
                const dcRef = `${entry.dc_book_id}::${entry.dc_number}`;
                return `<option value="${escapeHtml(dcRef)}" ${flow.linkDcRef === dcRef ? "selected" : ""}>${escapeHtml(`${entry.dc_book_id}-${entry.dc_number}`)} (${escapeHtml((labels.pendingItems || "Open items") + ": " + (entry.pending_items ?? 0))})</option>`;
              }
            )
            .join("")}
        </select>
      </label>
    `
    : "";
  const dispatchTargetType = "CUSTOMER";
  const dispatchRecipientEntries = (state.transitionUsers || [])
    .map((user) => {
      const id = String(user.id || "").trim();
      const userCode = String(user.user_code || "----").trim() || "----";
      const fullName = String(user.full_name || "").trim();
      const email = String(user.email || "").trim();
      const primaryName = fullName || email || userCode;
      return {
        id,
        userCode,
        fullName,
        email,
        label: `${userCode} - ${primaryName}`
      };
    })
    .filter((entry) => entry.id);
  const dispatchRecipientListOptions = dispatchRecipientEntries
    .map((entry) => `<option value="${escapeHtml(entry.label)}"></option>`)
    .join("");
  const selectedDispatchRecipient = dispatchRecipientEntries.find((entry) => entry.id === String(flow.dispatchUserId || "").trim()) || null;
  const dispatchUserQuery = String(flow.dispatchUserQuery || selectedDispatchRecipient?.label || "").trim();
  const customerSuggestionSet = new Set();
  (state.customerLocations || []).forEach((loc) => {
    const customerName = String(loc.customer_name || "").trim();
    if (customerName.length >= 2) {
      customerSuggestionSet.add(customerName);
    }
  });
  dispatchRecipientEntries.forEach((entry) => {
    const candidate = String(entry.fullName || entry.email || "").trim();
    if (candidate.length >= 2) {
      customerSuggestionSet.add(candidate);
    }
  });
  const customerSuggestionOptions = Array.from(customerSuggestionSet)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
  const dispatchTargetSection = flow.action === "GIVING"
    ? `
      <p class="form-section-title">${escapeHtml(labels.targetType || "Dispatch Target")}</p>
      <label>${escapeHtml(labels.targetCustomerName || "Customer name")}<input type="text" name="dispatch_customer_name" value="${escapeHtml(flow.dispatchCustomerName || "")}" list="dispatch-customer-suggestions" placeholder="${escapeHtml(labels.targetCustomerNamePlaceholder || "Enter customer name")}" autocomplete="off" required /></label>
      <datalist id="dispatch-customer-suggestions">${customerSuggestionOptions}</datalist>
    `
    : "";
  const processInfo = flow.processId
    ? `<p class="muted">${escapeHtml((labels.processIdLabel || "Process ID") + ": " + flow.processId)}</p>`
    : "";
  const selectedIdSet = new Set((flow.selectedItemIds || []).map((value) => String(value || "")).filter(Boolean));
  const selectedItems = (state.transitionItems || []).filter((item) => selectedIdSet.has(String(item.id || "")));
  const availableItems = (state.transitionItems || []).filter((item) => !selectedIdSet.has(String(item.id || "")));
  const selectedSourceType = String(flow.sourceType || "").trim().toUpperCase();
  const selectedSourceUserId = String(flow.sourceUserId || "").trim();
  const selectedSourceLocationId = String(flow.sourceLocationId || "").trim();
  const selectedSourceUser = (state.transitionUsers || []).find((user) => String(user.id || "").trim() === selectedSourceUserId) || null;
  const selectedSourceLocation = (state.customerLocations || []).find(
    (loc) => String(loc.id || "").trim() === selectedSourceLocationId && String(loc.user_id || "").trim() === selectedSourceUserId
  ) || null;
  const sourceSubjectName = selectedSourceUser
    ? String(selectedSourceUser.full_name || selectedSourceUser.email || selectedSourceUser.user_code || selectedSourceUser.id || "").trim()
    : "";
  const sourceLocationName = selectedSourceLocation
    ? String(selectedSourceLocation.location_name || "").trim()
    : "";
  const sourceSummaryText = (selectedSourceType === "EMPLOYEE" || selectedSourceType === "FILLER" || selectedSourceType === "CUSTOMER") && sourceSubjectName
    ? `${selectedSourceType === "EMPLOYEE" ? (labels.sourceUser || "Employee") : selectedSourceType === "FILLER" ? (labels.sourceFiller || "Filler") : (labels.sourceCustomer || "Customer")}: ${sourceSubjectName}${selectedSourceType === "CUSTOMER" && sourceLocationName ? ` (${sourceLocationName})` : ""}`
    : "";
  const isTransitDispatchStateLocked = String(flow.action || "").toUpperCase() === "GIVING" && selectedSourceType === "TRANSIT";
  const isLinkedTakingStateLocked = String(flow.action || "").toUpperCase() === "TAKING" && String(flow.linkDcRef || "").trim().length > 0;
  const infoMessagesStep3 = [
    labels.step3Hint || "Select one or more items and choose state",
    showDcBook ? dcBookHintText : "",
    flow.action === "TAKING" ? (labels.linkDcHint || "Optional for TAKING. If selected, EMPTY items are linked to an open GIVING DC and no new transfer row is created.") : "",
    isLinkedTakingStateLocked ? (labels.linkedTakingEmptyOnly || "Linked Collect mode: item state is fixed to EMPTY") : "",
    isTransitDispatchStateLocked ? (labels.transitDispatchStateLocked || "Transit Dispatch mode: item state cannot be changed") : "",
  ];
  const resolveSelectedState = (item) => {
    const itemId = String(item.id || "");
    const stored = String((flow.selectedItemStates || {})[itemId] || "").toUpperCase();
    if (stored === "FULL" || stored === "EMPTY") {
      return stored;
    }
    const sourceDefaultState = getTransitionDefaultFillStateBySource();
    if (sourceDefaultState === "FULL" || sourceDefaultState === "EMPTY") {
      return sourceDefaultState;
    }
    return String(item.fill_state || "").toUpperCase() === "FULL" ? "FULL" : "EMPTY";
  };

  return `
    <div class="view-stack transition-shell">
    <form id="transition-submit-form" class="grid transition-form-shell">
      ${renderTransitionInfoBlock(infoMessagesStep3)}
      ${sourceSummaryText ? `<p class="muted">${escapeHtml((labels.itemsFromSource || "Showing items for") + ": " + sourceSummaryText)}</p>` : ""}
      ${processInfo}
      ${dispatchTargetSection}
      ${dcBookSelect}
      ${dcLinkSelect}
      <div class="transition-item-columns">
      <div class="task-box">
        <h3>${escapeHtml(labels.availableItemsTitle || "Available Items")}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.select || "Select")}</th>
                <th>${escapeHtml(labels.itemId)}</th>
                <th>${escapeHtml(labels.title)}</th>
                <th>${escapeHtml(labels.currentState)}</th>
              </tr>
            </thead>
            <tbody>
              ${availableItems
                .map(
                  (item) => `
                    <tr>
                      <td><input type="checkbox" data-transition-select-item="${escapeHtml(item.id)}" /></td>
                      <td>${escapeHtml(item.item_code)}</td>
                      <td>${escapeHtml(item.title)}</td>
                      <td>${renderFillStateBadge(item.fill_state)}</td>
                    </tr>
                  `
                )
                .join("") || `<tr><td colspan="4" class="muted">${escapeHtml(labels.noAvailableItems || "No available items")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <div class="task-box">
        <h3>${escapeHtml(labels.selectedItemsTitle || "Selected Items")}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(labels.itemId)}</th>
                <th>${escapeHtml(labels.title)}</th>
                <th>${escapeHtml(labels.currentState)}</th>
                <th>${escapeHtml(labels.newState)}</th>
                <th>${escapeHtml(labels.actionRemove || "Remove")}</th>
              </tr>
            </thead>
            <tbody>
              ${selectedItems
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.item_code)}</td>
                      <td>${escapeHtml(item.title)}</td>
                      <td>${renderFillStateBadge(item.fill_state)}</td>
                      <td>
                        ${isTransitDispatchStateLocked
                          ? renderFillStateBadge(resolveSelectedState(item))
                          : isLinkedTakingStateLocked
                            ? renderFillStateBadge("EMPTY")
                            : renderFillStateRadioGroup(`item_state_${item.id}`, resolveSelectedState(item))}
                      </td>
                      <td><button type="button" data-transition-remove-item="${escapeHtml(item.id)}">${escapeHtml(labels.actionRemove || "Remove")}</button></td>
                    </tr>
                  `
                )
                .join("") || `<tr><td colspan="5" class="muted">${escapeHtml(labels.noSelectedItems || "No selected items")}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      </div>
      <div class="row">
        <button type="button" id="transition-back-2">${escapeHtml(labels.back)}</button>
        <button type="submit">${escapeHtml(labels.submit)}</button>
      </div>
    </form>
    </div>
  `;
}

function transferHistoryView() {
  if (!canAccessTransition()) {
    return `<p class="muted">${escapeHtml("Access denied")}</p>`;
  }

  const formatTransferAction = (reason, givingCount, takingCount) => {
    const value = String(reason || "").toUpperCase();
    if (value.includes("TRANSITION_GIVING")) {
      return "Dispatch";
    }
    if (value.includes("TRANSITION_TAKING")) {
      return "Collect";
    }
    if (Number(givingCount || 0) > 0 && Number(takingCount || 0) > 0) {
      return "Mixed";
    }
    if (Number(givingCount || 0) > 0) {
      return "Dispatch";
    }
    if (Number(takingCount || 0) > 0) {
      return "Collect";
    }
    return "-";
  };

  const expandedId = String(state.transferHistoryExpandedProcessId || "");
  const loadingId = String(state.transferHistoryLoadingProcessId || "");
  const detailsByProcess = state.transitionProcessDetails || {};

  const historyRows = (state.transitionProcesses || [])
    .map((entry) => {
      const processId = String(entry.id || "");
      const isExpanded = expandedId && expandedId === processId;
      const detailRows = detailsByProcess[processId] || [];
      const actionLabel = formatTransferAction(entry.last_action, entry.giving_count, entry.taking_count);
      const expandedContent = isExpanded
        ? `
          <tr>
            <td colspan="5">
              ${
                loadingId === processId
                  ? `<p class="muted">${escapeHtml("Loading details...")}</p>`
                  : `
                    <div class="transfer-details-shell">
                      <p class="muted transfer-details-caption">${escapeHtml("Details for selected process")}</p>
                      ${
                        detailRows.length > 0
                          ? `
                            <div class="transfer-details-grid">
                              ${detailRows
                                .map(
                                  (detail) => `
                                    <article class="transfer-detail-card">
                                      <div class="transfer-detail-head">
                                        <strong>${escapeHtml(detail.item_code || detail.item_id || "-")}</strong>
                                        <span class="muted">${escapeHtml(formatTransferAction(detail.reason, 0, 0))}</span>
                                      </div>
                                      <div class="transfer-detail-meta">
                                        <span><strong>${escapeHtml("From")}</strong>: ${escapeHtml(detail.from_location || detail.from_status || "-")}</span>
                                        <span><strong>${escapeHtml("To")}</strong>: ${escapeHtml(detail.to_location || detail.to_status || "-")}</span>
                                        <span><strong>${escapeHtml("By")}</strong>: ${escapeHtml(detail.transferred_by_name || "-")}</span>
                                        <span><strong>${escapeHtml("Time")}</strong>: ${escapeHtml(detail.transferred_at || "-")}</span>
                                      </div>
                                    </article>
                                  `
                                )
                                .join("")}
                            </div>
                          `
                          : `<p class="muted">${escapeHtml("No detailed transfers found")}</p>`
                      }
                    </div>
                  `
              }
            </td>
          </tr>
        `
        : "";

      return `
        <tr>
          <td>${escapeHtml(entry.created_by_name || "-")}</td>
          <td>${escapeHtml(entry.last_target || "-")}</td>
          <td>${escapeHtml(actionLabel)}</td>
          <td>${escapeHtml(entry.transfer_count ?? 0)}</td>
          <td><button type="button" data-transfer-more="${escapeHtml(processId)}">${escapeHtml(isExpanded ? "Less" : "More")}</button></td>
        </tr>
        ${expandedContent}
      `;
    })
    .join("");

  return `
    <div class="task-box">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>By</th>
              <th>To</th>
              <th>Action</th>
              <th>Count</th>
              <th>More</th>
            </tr>
          </thead>
          <tbody>
            ${historyRows || `<tr><td colspan="5" class="muted">${escapeHtml("No transfer history found")}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function resolveViewContent() {
  const labels = state.labels;
  switch (state.view) {
    case "items-list":
      return panel(labels.items.sectionTitle, labels.items.sectionSubtitle || "", itemsListView());
    case "users-list":
      return panel(labels.usersList.sectionTitle, labels.usersList.sectionSubtitle, usersListView());
    case "item-create":
      return panel(labels.itemCreate.sectionTitle, labels.itemCreate.sectionSubtitle, itemCreateView());
    case "item-update":
      return panel(labels.itemUpdate.sectionTitle, labels.itemUpdate.sectionSubtitle, itemUpdateView());
    case "company-setup":
      return panel(labels.companySetup.sectionTitle, labels.companySetup.sectionSubtitle, companySetupView());
    case "user-create":
      return panel(labels.userCreate.sectionTitle, labels.userCreate.sectionSubtitle, userCreateView());
    case "user-update":
      return panel(labels.userUpdate.sectionTitle, labels.userUpdate.sectionSubtitle, userUpdateView());
    case "role-update":
      return panel(labels.roleUpdate.sectionTitle, labels.roleUpdate.sectionSubtitle, roleUpdateView());
    case "analytics":
      return panel(labels.analytics.sectionTitle, labels.analytics.sectionSubtitle, analyticsView());
    case "login-controls":
      return panel(labels.loginControls.sectionTitle, labels.loginControls.sectionSubtitle, loginControlsView());
    case "transition":
      return panel(labels.transition.sectionTitle, labels.transition.sectionSubtitle, transitionView());
    case "transfer-history":
      return panel("Transfer History", "History of transfer processes", transferHistoryView());
    case "profile":
      return panel(labels.profile.sectionTitle, labels.profile.sectionSubtitle, profileView());
    case "admin-password-reset":
      return panel(labels.adminPasswordReset.sectionTitle, labels.adminPasswordReset.sectionSubtitle, adminPasswordResetView());
    case "backups":
      return panel(labels.backups.sectionTitle, labels.backups.sectionSubtitle, backupsView());
    case "orders":
      return panel(labels.orders.sectionTitle, labels.orders.sectionSubtitle, ordersView());
    case "notifications":
      return panel(labels.notifications.sectionTitle, labels.notifications.sectionSubtitle, notificationsView());
    case "super-admin":
      return panel(labels.superAdmin.sectionTitle, labels.superAdmin.sectionSubtitle, superAdminView());
    case "sessions":
      return panel(labels.sessions.sectionTitle, "", sessionsView());
    case "activity":
      return panel(labels.activity?.sectionTitle || "Activity Log", labels.activity?.sectionSubtitle || "Recent system activity", activityView());
    case "logs":
      return panel(labels.logs.sectionTitle, "", logsView());
    default:
      return panel(labels.items.sectionTitle, "", itemsListView());
  }
}

function attachNavigation() {
  const navigateToView = async (targetView) => {
    state.error = "";
    const allowedViews = getAllowedViews();
    if (!allowedViews.has(targetView)) {
      state.error = "Access denied for selected page";
      render();
      return;
    }
    state.view = targetView;
    try {
      await api("/api/navigation/event", {
        method: "POST",
        body: JSON.stringify({ path: state.view, title: mapViewTitle() })
      });
    } catch (error) {
      if (!error || error.status !== 404) {
        throw error;
      }
    }

    // Refresh core state once per navigation, then hydrate only view-specific extras.
    await hydrateDashboard();

    if (state.view === "analytics") {
      await hydrateAnalytics();
    }
    if (state.view === "login-controls") {
      if (!state.loginControlsUserId && state.users.length > 0) {
        state.loginControlsUserId = state.users[0].id;
      }
      await hydrateLoginControls();
    }
    if (state.view === "transition") {
      resetTransitionFlow();
      await hydrateTransitionUsers();
      await hydrateTransitionCustomerLocations();
      await hydrateTransitionProcesses();
    }
    if (state.view === "transfer-history") {
      await hydrateTransitionProcesses();
    }
    render();
  };

  document.querySelectorAll("[data-nav-group]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const targetGroup = String(button.getAttribute("data-nav-group") || "").trim();
        const allowedViews = getAllowedViews();
        const groups = getNavigationGroups(allowedViews, state.labels);
        const group = groups.find((entry) => entry.key === targetGroup);
        if (!group) {
          return;
        }
        state.navGroup = targetGroup;
        if (group.views.includes(state.view)) {
          render();
          return;
        }
        const landingView = group.defaultView && group.views.includes(group.defaultView) ? group.defaultView : group.views[0];
        await navigateToView(landingView);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const targetView = String(button.getAttribute("data-view") || "items-list");
        await navigateToView(targetView);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  });

  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    state.navGroup = "";
    state.user = null;
    state.profile = null;
    state.items = [];
    state.orders = [];
    state.users = [];
    state.sessions = [];
    state.notifications = [];
    state.logs = [];
    state.activityLogs = [];
    state.analytics = null;
    state.superAdminStats = null;
    state.backups = [];
    state.loginControls = [];
    state.loginControlsUserId = "";
    state.transitionUsers = [];
    state.transitionItems = [];
    state.transitionDcBooks = [];
    state.transitionProcesses = [];
    state.transitionProcessDetails = {};
    state.transferHistoryExpandedProcessId = "";
    state.transferHistoryLoadingProcessId = "";
    resetTransitionFlow();
    state.success = "";
    render();
  });

  const menuToggle = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");
  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("open");
      menuToggle.classList.toggle("open", isOpen);
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }
}

function attachForms() {
  bindUppercaseInputPolicy(document);
  attachPasswordStrengthMeters();

  const transitionInfoToggle = document.getElementById("transition-info-toggle");
  if (transitionInfoToggle) {
    transitionInfoToggle.addEventListener("click", () => {
      state.transitionInfoOpen = !state.transitionInfoOpen;
      renderPreservingScroll();
    });
  }
  attachPasswordFieldTools();
  attachGlobalSuccessModal();

  // Fix: clicking a datalist input that already has a value won't re-open suggestions in most browsers.
  // Selecting all text on click/focus forces the browser to re-show the suggestion list.
  document.querySelectorAll("input[list]").forEach((input) => {
    input.addEventListener("click", function () {
      this.select();
    });
    input.addEventListener("focus", function () {
      this.select();
    });
  });

  const itemCreateForm = document.getElementById("item-create-form");
  if (itemCreateForm) {
    const labels = state.labels.itemCreate || {};
    const syncItemCreateTypeFields = applyItemTypeFields(itemCreateForm, state.labels.itemCreate);
    const categoryTypeSelect = itemCreateForm.querySelector('[name="category_type_select"]');
    const showCategoryTypeSelect = !!categoryTypeSelect && String(categoryTypeSelect.tagName || "").toUpperCase() === "SELECT";
    const itemCreateCategorySelect = itemCreateForm.querySelector('select[name="category_select"]');
    const itemCreateCodePreviewInput = itemCreateForm.querySelector("#item-create-code-preview");
    const itemCreateLocationSelect = itemCreateForm.querySelector('select[name="company_location_id"]');
    const itemCreateOwnershipTypeSelect = itemCreateForm.querySelector('select[name="ownership_type"]');
    const itemCreateTypeSelect = itemCreateForm.querySelector('select[name="item_type"]');
    const itemCreateExternalOwnerField = itemCreateForm.querySelector('[data-external-owner-field]');
    const itemCreateExternalOwnerSelect = itemCreateForm.querySelector('select[name="external_owner_name"]');
    const locationSection = itemCreateForm.querySelector('[data-location-section]');
    const locationField = itemCreateForm.querySelector('[data-location-field]');
    let itemCreateCategoryPreviewRequestId = 0;
    const getItemCreateCategoryType = () => String(categoryTypeSelect?.value || "").trim().toUpperCase();
    const getItemCreateCategory = () => String(itemCreateCategorySelect?.value || "").trim();
    const getItemCreatePrefix = () => {
      const prefixSelect = document.getElementById("item-create-prefix-select");
      return String(prefixSelect?.value || "").trim();
    };
    const updateItemCreatePrefixSelector = (categoryName) => {
      const container = document.getElementById("item-create-prefix-container");
      const prefixSelect = document.getElementById("item-create-prefix-select");
      if (!container || !prefixSelect) return;
      const cat = (state.itemCategories || []).find(
        (c) => String(c.category_name || "").trim().toLowerCase() === String(categoryName || "").trim().toLowerCase()
      );
      const prefixes = Array.isArray(cat?.prefixes) ? cat.prefixes.filter((p) => p) : [];
      if (prefixes.length > 1) {
        prefixSelect.innerHTML = prefixes
          .map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
          .join("");
        container.style.display = "";
      } else {
        container.style.display = "none";
        prefixSelect.innerHTML = "";
      }
    };
    const updateItemCreateCategoryOptions = () => {
      if (!itemCreateCategorySelect) {
        return;
      }
      const selectedType = getItemCreateCategoryType();
      const selectedCategory = getItemCreateCategory();
      const options = [`<option value="">${escapeHtml(labels.selectCategory || "Select Category")}</option>`];
      options.push(renderCategoryNameOptions(selectedCategory, selectedType));
      itemCreateCategorySelect.innerHTML = options.join("");
      itemCreateCategorySelect.value = selectedCategory;
    };
    const syncItemCreateCategorySelect = () => {
      updateItemCreateCategoryOptions();
      const selectedCategory = getItemCreateCategory();
      updateItemCreatePrefixSelector(selectedCategory);
    };
    const refreshItemCreateCodePreview = async () => {
      if (!itemCreateCategorySelect) {
        return;
      }
      const category = getItemCreateCategory();
      const prefix = getItemCreatePrefix();
      const itemType = normalizeItemTypeClient(itemCreateTypeSelect?.value);
      const requestId = ++itemCreateCategoryPreviewRequestId;
      const nextCode = category
        ? await fetchNextItemCode(category, prefix, itemType)
        : await fetchNextItemCode("", "", itemType);
      if (requestId !== itemCreateCategoryPreviewRequestId) {
        return;
      }
      state.lastGeneratedItemCode = nextCode;
      if (itemCreateCodePreviewInput) {
        itemCreateCodePreviewInput.value = nextCode;
      }
    };
    const itemCreatePrefixSelect = document.getElementById("item-create-prefix-select");
    if (itemCreatePrefixSelect) {
      itemCreatePrefixSelect.addEventListener("change", async () => {
        try {
          await refreshItemCreateCodePreview();
        } catch {
          // Ignore preview failures.
        }
      });
    }
    if (categoryTypeSelect) {
      categoryTypeSelect.addEventListener("change", async () => {
        try {
          syncItemCreateCategorySelect();
          await refreshItemCreateCodePreview();
        } catch {
          // Ignore preview failures.
        }
      });
    }
    if (itemCreateCategorySelect) {
      itemCreateCategorySelect.addEventListener("change", async () => {
        try {
          const selectedCategory = getItemCreateCategory();
          const selectedType = getItemCreateCategoryType();
          if (selectedType && selectedCategory) {
            const matchedType = (state.itemCategories || []).find((entry) => String(entry.category_name || "").trim().toLowerCase() === selectedCategory.toLowerCase());
            if (matchedType && String(matchedType.item_type || "").trim().toUpperCase() !== selectedType) {
              itemCreateCategorySelect.value = "";
              updateItemCreatePrefixSelector("");
              state.lastGeneratedItemCode = "";
              if (itemCreateCodePreviewInput) {
                itemCreateCodePreviewInput.value = "";
              }
              return;
            }
          }
          updateItemCreatePrefixSelector(getItemCreateCategory());
          await refreshItemCreateCodePreview();
        } catch {
          // Ignore preview failures; final create is validated server-side.
        }
      });
      syncItemCreateCategorySelect();
    }
    if (itemCreateTypeSelect) {
      itemCreateTypeSelect.addEventListener("change", async () => {
        try {
          await refreshItemCreateCodePreview();
        } catch {
          // Ignore preview failures.
        }
      });
    }



    const syncItemCreateOwnershipFields = () => {
      const ownershipType = String(itemCreateOwnershipTypeSelect?.value || "OURS").trim().toUpperCase();
      const isExternal = ownershipType === "EXTERNAL";
      if (itemCreateExternalOwnerField) {
        itemCreateExternalOwnerField.style.display = isExternal ? "" : "none";
      }
      if (itemCreateExternalOwnerSelect) {
        itemCreateExternalOwnerSelect.required = isExternal;
        if (!isExternal) {
          itemCreateExternalOwnerSelect.value = "";
        }
      }
      if (locationSection) {
        locationSection.style.display = isExternal ? "none" : "";
      }
      if (locationField) {
        locationField.style.display = isExternal ? "none" : "";
        locationField.required = !isExternal;
      }
    };

    if (itemCreateOwnershipTypeSelect) {
      itemCreateOwnershipTypeSelect.addEventListener("change", syncItemCreateOwnershipFields);
    }
    syncItemCreateOwnershipFields();

    refreshItemCreateCodePreview().catch(() => {});
    itemCreateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(itemCreateForm);
      const title = String(formData.get("title") || "").trim();
      const quantityRaw = String(formData.get("quantity") || "1").trim();
      const fillState = String(formData.get("fill_state") || "EMPTY").trim().toUpperCase();
      const status = String(formData.get("status") || "").trim().toUpperCase();
      const category = getItemCreateCategory();
      const ownershipType = String(formData.get("ownership_type") || "OURS").trim().toUpperCase();
      const ownerName = String(formData.get("external_owner_name") || "").trim();
      const itemType = normalizeItemTypeClient(formData.get("item_type"));
      const volumeUnitRaw = normalizeVolumeUnitClient(formData.get("volume_unit"));
      const capacityRaw = String(formData.get("capacity") || "").trim();
      const companyLocationId = String(formData.get("company_location_id") || "").trim();
      const customIdInput = normalizeCustomIdInput(formData.get("custom_id"));
      const hasActiveCompanyLocations = (state.companyLocations || []).some((location) => !!location?.is_active);
      const fallbackCompanyLocationName = getFallbackCompanyLocationName();
      const quantity = parseInt(quantityRaw, 10);
      const categoryType = String(formData.get("category_type_select") || "").trim().toUpperCase();

      if (title.length < 2 || title.length > 200) {
        state.error = "Title must be between 2 and 200 characters";
        render();
        return;
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        state.error = "Quantity must be a whole number between 1 and 100";
        render();
        return;
      }
      if (customIdInput.value && quantity > 1) {
        state.error = "Custom ID can be assigned only when quantity is 1";
        render();
        return;
      }
      if (!ITEM_STATUS_SET.has(status)) {
        state.error = "Invalid item status";
        render();
        return;
      }
      if (!FILL_STATE_SET.has(fillState)) {
        state.error = "Invalid item state";
        render();
        return;
      }
      if (!category) {
        state.error = "Select category";
        render();
        return;
      }
      if (showCategoryTypeSelect && !categoryType) {
        state.error = "Select category type";
        render();
        return;
      }
      if (showCategoryTypeSelect) {
        const matchedCategory = (state.itemCategories || []).find((entry) => String(entry.category_name || "").trim().toLowerCase() === category.toLowerCase());
        if (matchedCategory && String(matchedCategory.item_type || "").trim().toUpperCase() !== categoryType) {
          state.error = "Select a category that matches the chosen category type";
          render();
          return;
        }
      }
      if (categoryTypeSelect && !showCategoryTypeSelect && !categoryType) {
        state.error = "Select category type";
        render();
        return;
      }
      if (category.length < 2 || category.length > 80) {
        state.error = "Category must be between 2 and 80 characters";
        render();
        return;
      }
      if (!["OURS", "EXTERNAL"].includes(ownershipType)) {
        state.error = "Ownership must be OURS or EXTERNAL";
        render();
        return;
      }
      if (ownershipType === "EXTERNAL" && (ownerName.length < 2 || ownerName.length > 120)) {
        state.error = "Owner name is required for external items and must be between 2 and 120 characters";
        render();
        return;
      }
      if (ownerName.length > 120) {
        state.error = "Owner name must be at most 120 characters";
        render();
        return;
      }
      if (!ITEM_TYPE_SET.has(itemType)) {
        state.error = "Item type must be CONTAINER, CYLINDER, or OTHER";
        render();
        return;
      }
      if (customIdInput.error) {
        state.error = customIdInput.error;
        render();
        return;
      }
      const parsedCapacity = parseCapacityInput(capacityRaw);
      if (parsedCapacity.error) {
        state.error = parsedCapacity.error;
        render();
        return;
      }
      if (itemType === "CYLINDER" && !getCylinderVolumeUnitSet().has(volumeUnitRaw)) {
        state.error = "Select a valid cylinder volume unit";
        render();
        return;
      }
      if (status === "WITH_ME" && state.apiAvailability.companySetup && hasActiveCompanyLocations) {
        if (!companyLocationId) {
          state.error = "Select location";
          render();
          return;
        }
      }

      if (!state.lastGeneratedItemCode) {
        await hydrateNextItemCode(category);
      }

      try {
        const createdItemCodes = [];
        for (let i = 0; i < quantity; i += 1) {
          const selectedPrefix = getItemCreatePrefix();
          const result = await api("/api/items/register", {
            method: "POST",
            body: JSON.stringify({
              title,
              category,
              custom_id: customIdInput.value || undefined,
              code_prefix: selectedPrefix || undefined,
              ownership_type: ownershipType,
              owner_name: ownershipType === "EXTERNAL" ? ownerName : "",
              item_type: itemType,
              volume_unit: itemType === "CYLINDER" ? volumeUnitRaw : null,
              capacity: parsedCapacity.normalized,
              fill_state: fillState,
              status,
              current_location: status === "WITH_ME" && !companyLocationId ? fallbackCompanyLocationName : "",
              company_location_id: companyLocationId
            })
          });
          if (result?.item_code) {
            createdItemCodes.push(result.item_code);
          }
        }

        state.lastGeneratedItemCode = createdItemCodes[createdItemCodes.length - 1] || "";
        if (itemCreateCodePreviewInput) {
          itemCreateCodePreviewInput.value = state.lastGeneratedItemCode;
        }
        await hydrateDashboard();
        state.success = "Success";
        state.view = "items-list";
        render();
        syncItemCreateTypeFields();
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const itemUpdateForm = document.getElementById("item-update-form");
  if (itemUpdateForm) {
    const itemSelect = itemUpdateForm.querySelector('select[name="item_id"]');
    const itemCodeDisplayInput = itemUpdateForm.querySelector('input[name="item_code_display"]');
    const customIdInput = itemUpdateForm.querySelector('input[name="custom_id"]');
    const titleInput = itemUpdateForm.querySelector('input[name="title"]');
    const categorySelect = itemUpdateForm.querySelector('select[name="category_select"]');
    const itemTypeInput = itemUpdateForm.querySelector('select[name="item_type"]');
    const volumeUnitInput = itemUpdateForm.querySelector('select[name="volume_unit"]');
    const capacityInput = itemUpdateForm.querySelector('input[name="capacity"]');
    const statusInput = itemUpdateForm.querySelector('[name="status"]');
    const companyLocationInput = itemUpdateForm.querySelector('[name="company_location_id"]');
    const locationSection = itemUpdateForm.querySelector('[data-location-section]');
    const locationField = itemUpdateForm.querySelector('[data-location-field]');
    const ownershipTypeInput = itemUpdateForm.querySelector('select[name="ownership_type"]');
    const externalOwnerField = itemUpdateForm.querySelector('[data-external-owner-field]');
    const externalOwnerSelect = itemUpdateForm.querySelector('select[name="external_owner_name"]');
    const expectedUpdatedAtInput = itemUpdateForm.querySelector('input[name="expected_updated_at"]');
    const syncItemUpdateTypeFields = applyItemTypeFields(itemUpdateForm, state.labels.itemUpdate);
    const getItemUpdateCategory = () => String(categorySelect?.value || "").trim();
      const syncItemUpdateOwnershipFields = () => {
      const ownershipType = String(ownershipTypeInput?.value || "OURS").trim().toUpperCase();
      const isExternal = ownershipType === "EXTERNAL";
      if (externalOwnerField) {
        externalOwnerField.style.display = isExternal ? "" : "none";
      }
      if (externalOwnerSelect) {
        externalOwnerSelect.required = isExternal;
        if (!isExternal) {
          externalOwnerSelect.value = "";
        }
      }
      const locationSection = itemUpdateForm?.querySelector('[data-location-section]');
      if (locationSection) {
        locationSection.style.display = isExternal ? "none" : "";
      }
      if (locationField) {
        locationField.style.display = isExternal ? "none" : "";
        locationField.required = !isExternal;
      }
    };
    const syncItemCodeDisplay = () => {
      if (!itemSelect || !itemCodeDisplayInput) {
        return;
      }
      const selectedItem = state.items.find((item) => item.id === String(itemSelect.value));
      itemCodeDisplayInput.value = selectedItem?.item_code || "";
      if (customIdInput) {
        const selectedCustomId = String(selectedItem?.custom_id || "").trim().toUpperCase();
        customIdInput.value = selectedCustomId;
      }
      if (expectedUpdatedAtInput) {
        expectedUpdatedAtInput.value = selectedItem?.updated_at || "";
      }
      if (selectedItem && titleInput && itemTypeInput && volumeUnitInput && capacityInput && statusInput && companyLocationInput) {
        titleInput.value = selectedItem.title || "";
        if (categorySelect) {
          categorySelect.innerHTML = renderCategorySelectOptions(selectedItem.category || "", { includeCustom: false });
          categorySelect.value = selectedItem.category || "";
        }
        if (ownershipTypeInput) {
          ownershipTypeInput.value = String(selectedItem.ownership_type || "OURS").toUpperCase() === "EXTERNAL" ? "EXTERNAL" : "OURS";
        }
        if (externalOwnerSelect) {
          const selectedOwnerName = selectedItem.owner_name || "";
          externalOwnerSelect.innerHTML = renderExternalPartnerOwnerOptions(selectedOwnerName, {
            blankLabel: state.labels.itemUpdate?.selectExternalPartner || "Select External Partner",
          });
          externalOwnerSelect.value = selectedOwnerName;
        }
        itemTypeInput.value = normalizeItemTypeClient(selectedItem.item_type);
        volumeUnitInput.value = normalizeVolumeUnitClient(selectedItem.volume_unit);
        capacityInput.value = selectedItem.capacity ?? "";
        setFillStateFieldValue(itemUpdateForm, "fill_state", selectedItem.fill_state || "EMPTY");
        statusInput.value = selectedItem.status || "WITH_ME";
        companyLocationInput.value = String(selectedItem.company_location_id || "").trim();
        syncItemUpdateOwnershipFields();
        syncItemUpdateTypeFields();
      }
    };



    if (ownershipTypeInput) {
      ownershipTypeInput.addEventListener("change", syncItemUpdateOwnershipFields);
    }
    if (itemSelect && itemCodeDisplayInput) {
      itemSelect.addEventListener("change", syncItemCodeDisplay);
      syncItemCodeDisplay();
    }

    itemUpdateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(itemUpdateForm);
      const selectedItem = state.items.find((item) => item.id === String(formData.get("item_id") || ""));
      const targetStatus = String(formData.get("status") || "").trim().toUpperCase();
      const itemType = normalizeItemTypeClient(formData.get("item_type"));
      const volumeUnitRaw = normalizeVolumeUnitClient(formData.get("volume_unit"));
      const ownershipType = String(formData.get("ownership_type") || "OURS").trim().toUpperCase();
      const ownerName = String(formData.get("external_owner_name") || "").trim();
      const allowedStatuses = new Set(getAllowedNextStatuses(selectedItem?.status || ""));
      const expectedUpdatedAt = String(formData.get("expected_updated_at") || "").trim();
      const parsedCapacity = parseCapacityInput(formData.get("capacity"));
      const customIdInputValue = normalizeCustomIdInput(formData.get("custom_id"));
      if (!allowedStatuses.has(targetStatus)) {
        state.error = `Invalid status transition from ${selectedItem?.status || "UNKNOWN"} to ${targetStatus}`;
        render();
        return;
      }
      if (!expectedUpdatedAt) {
        state.error = "This item is missing its latest revision marker. Refresh and try again.";
        render();
        return;
      }
      if (!ITEM_TYPE_SET.has(itemType)) {
        state.error = "Item type must be CONTAINER, CYLINDER, or OTHER";
        render();
        return;
      }
      if (customIdInputValue.error) {
        state.error = customIdInputValue.error;
        render();
        return;
      }
      if (targetStatus === "WITH_ME" && state.apiAvailability.companySetup) {
        if (!String(formData.get("company_location_id") || "").trim()) {
          state.error = "Select location";
          render();
          return;
        }
      }
      if (parsedCapacity.error) {
        state.error = parsedCapacity.error;
        render();
        return;
      }
      if (itemType === "CYLINDER" && !getCylinderVolumeUnitSet().has(volumeUnitRaw)) {
        state.error = "Select a valid cylinder volume unit";
        render();
        return;
      }
      const category = getItemUpdateCategory();
      if (category.length < 2 || category.length > 80) {
        state.error = "Category must be between 2 and 80 characters";
        render();
        return;
      }
      if (!["OURS", "EXTERNAL"].includes(ownershipType)) {
        state.error = "Ownership must be OURS or EXTERNAL";
        render();
        return;
      }
      if (ownershipType === "EXTERNAL" && (ownerName.length < 2 || ownerName.length > 120)) {
        state.error = "Owner name is required for external items and must be between 2 and 120 characters";
        render();
        return;
      }
      if (ownerName.length > 120) {
        state.error = "Owner name must be at most 120 characters";
        render();
        return;
      }
      try {
        await api("/api/items/update", {
          method: "POST",
          body: JSON.stringify({
            item_id: formData.get("item_id"),
            title: formData.get("title"),
            category,
            custom_id: customIdInputValue.value || undefined,
            ownership_type: ownershipType,
            owner_name: ownershipType === "EXTERNAL" ? ownerName : "",
            item_type: itemType,
            volume_unit: itemType === "CYLINDER" ? volumeUnitRaw : null,
            capacity: parsedCapacity.normalized,
            fill_state: formData.get("fill_state"),
            status: formData.get("status"),
            current_location: "",
            company_location_id: formData.get("company_location_id"),
            expected_updated_at: expectedUpdatedAt
          })
        });
        await hydrateDashboard();
        state.view = "items-list";
        render();
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const userCreateForm = document.getElementById("user-create-form");
  if (userCreateForm) {
    const createRoleInput = userCreateForm.querySelector('select[name="role"]');
    const createRejectFullInput = userCreateForm.querySelector('input[name="reject_full_items"]');
    const createRejectEmptyInput = userCreateForm.querySelector('input[name="reject_empty_items"]');
    const createFillPolicyTitle = userCreateForm.querySelector('[data-fill-policy-title]');
    const createRejectFullLabel = userCreateForm.querySelector('[data-reject-full-policy]');
    const createRejectEmptyLabel = userCreateForm.querySelector('[data-reject-empty-policy]');
    const syncCreateFillPolicyVisibility = () => {
      const selectedRole = normalizeUserRoleValue(createRoleInput?.value);
      const shouldHide = ["DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(selectedRole);
      if (createFillPolicyTitle) {
        createFillPolicyTitle.style.display = shouldHide ? "none" : "";
      }
      if (createRejectFullLabel) {
        createRejectFullLabel.style.display = shouldHide ? "none" : "";
      }
      if (createRejectEmptyLabel) {
        createRejectEmptyLabel.style.display = shouldHide ? "none" : "";
      }
      if (shouldHide) {
        if (createRejectFullInput) {
          createRejectFullInput.checked = false;
        }
        if (createRejectEmptyInput) {
          createRejectEmptyInput.checked = false;
        }
      }
    };
    if (createRoleInput) {
      createRoleInput.addEventListener("change", syncCreateFillPolicyVisibility);
      syncCreateFillPolicyVisibility();
    }

    userCreateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(userCreateForm);
      const fullName = String(formData.get("full_name") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const role = normalizeUserRoleValue(formData.get("role"));
      const allowFillPolicy = !["DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(role);
      const rejectFullItems = allowFillPolicy && formData.get("reject_full_items") === "on";
      const rejectEmptyItems = allowFillPolicy && formData.get("reject_empty_items") === "on";
      const securityKeys = readSecurityKeys(formData);

      const hasValidEmail = email.includes("@") && email.indexOf("@") > 0 && email.split("@").length === 2 && email.split("@")[1].includes(".");
      const allowedRoles = new Set(["CUSTOMER", "FILLER", "DELIVERY_PARTNER", "EXTERNAL_PARTNER", "ADMIN"]);
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasDigit = /\d/.test(password);
      const hasSymbol = /[^A-Za-z0-9]/.test(password);

      if (fullName.length < 2 || fullName.length > 120) {
        state.error = "Full name must be between 2 and 120 characters";
        render();
        return;
      }
      if (!hasValidEmail) {
        state.error = "Valid email is required";
        render();
        return;
      }
      if (!allowedRoles.has(role)) {
        state.error = "Invalid role";
        render();
        return;
      }
      if (password.length < 8 || password.length > 128 || !(hasUpper && hasLower && hasDigit && hasSymbol)) {
        state.error = "Password must include upper, lower, number and symbol";
        render();
        return;
      }
      const securityError = validateSecurityKeysInput(securityKeys);
      if (securityError) {
        state.error = securityError;
        render();
        return;
      }

      try {
        await api("/api/users/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName,
            email,
            password,
            role,
            reject_full_items: rejectFullItems,
            reject_empty_items: rejectEmptyItems,
            security_key_1: securityKeys.key1,
            security_key_2: securityKeys.key2,
            security_key_3: securityKeys.key3
          })
        });
        await hydrateDashboard();
        handleSuccessfulFormSubmission(userCreateForm);
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const userUpdateForm = document.getElementById("user-update-form");
  if (userUpdateForm) {
    const userSelect = userUpdateForm.querySelector('select[name="user_id"]');
    const userCodeDisplayInput = userUpdateForm.querySelector('input[name="user_code_display"]');
    const fullNameInput = userUpdateForm.querySelector('input[name="full_name"]');
    const emailInput = userUpdateForm.querySelector('input[name="email"]');
    const isActiveInput = userUpdateForm.querySelector('select[name="is_active"]');
    const roleInput = userUpdateForm.querySelector('select[name="role"]');
    const rejectFullItemsInput = userUpdateForm.querySelector('input[name="reject_full_items"]');
    const rejectEmptyItemsInput = userUpdateForm.querySelector('input[name="reject_empty_items"]');
    const updateFillPolicyTitle = userUpdateForm.querySelector('[data-fill-policy-title]');
    const updateRejectFullLabel = userUpdateForm.querySelector('[data-reject-full-policy]');
    const updateRejectEmptyLabel = userUpdateForm.querySelector('[data-reject-empty-policy]');
    const syncUpdateFillPolicyVisibility = () => {
      const selectedRole = normalizeUserRoleValue(roleInput?.value);
      const shouldHide = ["DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(selectedRole);
      if (updateFillPolicyTitle) {
        updateFillPolicyTitle.style.display = shouldHide ? "none" : "";
      }
      if (updateRejectFullLabel) {
        updateRejectFullLabel.style.display = shouldHide ? "none" : "";
      }
      if (updateRejectEmptyLabel) {
        updateRejectEmptyLabel.style.display = shouldHide ? "none" : "";
      }
      if (shouldHide) {
        if (rejectFullItemsInput) {
          rejectFullItemsInput.checked = false;
        }
        if (rejectEmptyItemsInput) {
          rejectEmptyItemsInput.checked = false;
        }
      }
    };
    const syncUserCodeDisplay = () => {
      if (!userSelect || !userCodeDisplayInput) {
        return;
      }
      const selectedUser = state.users.find((user) => user.id === String(userSelect.value));
      userCodeDisplayInput.value = selectedUser?.user_code || "";
      if (selectedUser && fullNameInput && emailInput && isActiveInput && roleInput) {
        fullNameInput.value = selectedUser.full_name || "";
        emailInput.value = selectedUser.email || "";
        isActiveInput.value = selectedUser.is_active ? "true" : "false";
        roleInput.value = selectedUser.role || "CUSTOMER";
        if (rejectFullItemsInput) {
          rejectFullItemsInput.checked = !!selectedUser.reject_full_items;
        }
        if (rejectEmptyItemsInput) {
          rejectEmptyItemsInput.checked = !!selectedUser.reject_empty_items;
        }
        syncUpdateFillPolicyVisibility();
      }
    };
    if (userSelect && userCodeDisplayInput) {
      userSelect.addEventListener("change", syncUserCodeDisplay);
      syncUserCodeDisplay();
    }
    if (roleInput) {
      roleInput.addEventListener("change", syncUpdateFillPolicyVisibility);
    }
    // When user selection changes, update which customer locations are shown
    if (userSelect) {
      userSelect.addEventListener("change", () => {
        state.customerLocationsViewUserId = userSelect.value;
        state.customerLocationSelectedId = "";
        state.fillerLocationSelectedId = "";
        renderPreservingScroll();
      });
    }

    userUpdateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(userUpdateForm);
      const targetUserId = String(formData.get("user_id") || "").trim();
      const targetUser = (state.users || []).find((user) => String(user.id || "") === targetUserId);
      const selectedRole = normalizeUserRoleValue(formData.get("role"));
      if (String(targetUser?.role || "").trim().toUpperCase() === "SUPER_ADMIN") {
        state.error = "Super Admin can be updated only from Profile page";
        render();
        return;
      }
      const securityKeys = readSecurityKeys(formData);
      const securityError = validateSecurityKeysInput(securityKeys);
      if (securityError) {
        state.error = securityError;
        render();
        return;
      }
      try {
        await api("/api/users/update", {
          method: "POST",
          body: JSON.stringify({
            user_id: targetUserId,
            full_name: formData.get("full_name"),
            email: formData.get("email"),
            is_active: String(formData.get("is_active")) === "true",
            reject_full_items: !["DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(selectedRole) && formData.get("reject_full_items") === "on",
            reject_empty_items: !["DELIVERY_PARTNER", "EXTERNAL_PARTNER"].includes(selectedRole) && formData.get("reject_empty_items") === "on",
            role: formData.get("role"),
            new_password: formData.get("new_password"),
            security_key_1: securityKeys.key1,
            security_key_2: securityKeys.key2,
            security_key_3: securityKeys.key3
          })
        });
        await hydrateDashboard();
        render();
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const companyUpsertForm = document.getElementById("company-upsert-form");
  if (companyUpsertForm) {
    companyUpsertForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(companyUpsertForm);
      const companyNameInput = companyUpsertForm.querySelector('input[name="company_name"]');
      const companyName = String(companyNameInput?.value || formData.get("company_name") || "").trim();
      const contactInfo = String(formData.get("contact_info") || "").trim();
      if (companyName.length < 2 || companyName.length > 120) {
        state.error = "Company name must be between 2 and 120 characters";
        render();
        return;
      }
      if (contactInfo.length > 240) {
        state.error = "Contact info must be at most 240 characters";
        render();
        return;
      }
      try {
        await api("/api/companies/upsert", {
          method: "POST",
          body: JSON.stringify({
            company_id: formData.get("company_id") || "",
            company_name: companyName,
            contact_info: contactInfo,
            is_active: String(formData.get("is_active")) === "true",
          }),
        });
        await hydrateDashboard();
        const didReset = handleSuccessfulFormSubmission(companyUpsertForm);
        if (didReset) {
          state.companySetupSelectedCompanyId = "";
          render();
        }
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const companyLocationUpsertForm = document.getElementById("company-location-upsert-form");
  if (companyLocationUpsertForm) {
    companyLocationUpsertForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(companyLocationUpsertForm);
      const companyId = String(formData.get("company_id") || "").trim();
      const locationName = String(formData.get("location_name") || "").trim();
      const addressLine = String(formData.get("address_line") || "").trim();
      if (locationName.length < 2 || locationName.length > 120) {
        state.error = "Location name must be between 2 and 120 characters";
        render();
        return;
      }
      if (addressLine.length > 240) {
        state.error = "Address must be at most 240 characters";
        render();
        return;
      }
      try {
        await api("/api/company-locations/upsert", {
          method: "POST",
          body: JSON.stringify({
            location_id: formData.get("location_id") || "",
            company_id: companyId,
            location_name: locationName,
            address_line: addressLine,
            is_active: String(formData.get("is_active")) === "true",
          }),
        });
        await hydrateDashboard();
        const didReset = handleSuccessfulFormSubmission(companyLocationUpsertForm);
        if (didReset) {
          state.companySetupSelectedLocationId = "";
          render();
        }
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const clearCompanySelection = document.getElementById("company-clear-selection");
  if (clearCompanySelection) {
    clearCompanySelection.addEventListener("click", () => {
      state.companySetupSelectedCompanyId = "";
      render();
    });
  }

  const clearLocationSelection = document.getElementById("location-clear-selection");
  if (clearLocationSelection) {
    clearLocationSelection.addEventListener("click", () => {
      state.companySetupSelectedLocationId = "";
      render();
    });
  }

  document.querySelectorAll("[data-company-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.companySetupSelectedCompanyId = String(button.getAttribute("data-company-select") || "").trim();
      state.companySetupSelectedLocationId = "";
      renderPreservingScroll();
    });
  });

  document.querySelectorAll("[data-location-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const locationId = String(button.getAttribute("data-location-select") || "").trim();
      const selectedLocation = (state.companyLocations || []).find((entry) => String(entry.id || "") === locationId);
      state.companySetupSelectedLocationId = locationId;
      if (selectedLocation) {
        state.companySetupSelectedCompanyId = String(selectedLocation.company_id || "");
      }
      renderPreservingScroll();
    });
  });


  const custLocForm = document.getElementById("customer-location-upsert-form");
  if (custLocForm) {
    custLocForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(custLocForm);
      const userId = String(formData.get("user_id") || "").trim();
      const locationName = String(formData.get("location_name") || "").trim();
      const addressLine = String(formData.get("address_line") || "").trim();
      if (!userId) { state.error = "Select a customer (user)"; render(); return; }
      if (locationName.length < 2 || locationName.length > 120) { state.error = "Location name must be 2-120 characters"; render(); return; }
      try {
        await api("/api/customer-locations/upsert", { method: "POST", body: JSON.stringify({ loc_id: formData.get("loc_id") || "", user_id: userId, location_name: locationName, address_line: addressLine, is_active: String(formData.get("is_active")) === "true" }) });
        await hydrateCompanies();
        const didReset = handleSuccessfulFormSubmission(custLocForm);
        if (didReset) { state.customerLocationSelectedId = ""; state.customerLocationsViewUserId = ""; render(); }
      } catch (error) { state.error = error.message; render(); }
    });
  }

  const fillerLocForm = document.getElementById("filler-location-upsert-form");
  if (fillerLocForm) {
    fillerLocForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(fillerLocForm);
      const fillerUserId = String(formData.get("filler_user_id") || "").trim();
      const locationName = String(formData.get("location_name") || "").trim();
      const addressLine = String(formData.get("address_line") || "").trim();
      if (!fillerUserId) { state.error = "Select a filler user"; render(); return; }
      if (locationName.length < 2 || locationName.length > 120) { state.error = "Location name must be 2-120 characters"; render(); return; }
      try {
        await api("/api/filler-locations/upsert", { method: "POST", body: JSON.stringify({ loc_id: formData.get("loc_id") || "", filler_user_id: fillerUserId, location_name: locationName, address_line: addressLine, is_active: String(formData.get("is_active")) === "true" }) });
        await hydrateCompanies();
        const didReset = handleSuccessfulFormSubmission(fillerLocForm);
        if (didReset) { state.fillerLocationSelectedId = ""; render(); }
      } catch (error) { state.error = error.message; render(); }
    });
  }

  const clearFillerLocSelection = document.getElementById("filler-loc-clear-selection");
  if (clearFillerLocSelection) { clearFillerLocSelection.addEventListener("click", () => { state.fillerLocationSelectedId = ""; render(); }); }

  document.querySelectorAll("[data-cust-loc-select]").forEach((button) => {
    button.addEventListener("click", () => { state.customerLocationSelectedId = String(button.getAttribute("data-cust-loc-select") || "").trim(); renderPreservingScroll(); });
  });

  document.querySelectorAll("[data-filler-loc-select]").forEach((button) => {
    button.addEventListener("click", () => { state.fillerLocationSelectedId = String(button.getAttribute("data-filler-loc-select") || "").trim(); renderPreservingScroll(); });
  });

  document.querySelectorAll("[data-fill-state-select]").forEach((select) => {
    select.addEventListener("change", () => syncFillStateFieldAppearance(select));
    syncFillStateFieldAppearance(select);
  });

  const roleUpdateForm = document.getElementById("role-update-form");
  if (roleUpdateForm) {
    const roleUserSelect = roleUpdateForm.querySelector('select[name="user_id"]');
    const roleUserCodeDisplayInput = roleUpdateForm.querySelector('input[name="user_code_display"]');
    const syncRoleUserCodeDisplay = () => {
      if (!roleUserSelect || !roleUserCodeDisplayInput) {
        return;
      }
      const selectedUser = state.users.find((user) => user.id === String(roleUserSelect.value));
      roleUserCodeDisplayInput.value = selectedUser?.user_code || "";
    };
    if (roleUserSelect && roleUserCodeDisplayInput) {
      roleUserSelect.addEventListener("change", syncRoleUserCodeDisplay);
      syncRoleUserCodeDisplay();
    }

    roleUpdateForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      if (!state.apiAvailability.updateRole) {
        state.error = state.labels.roleUpdate.endpointMissing || "Role update endpoint is not available in current backend";
        render();
        return;
      }
      const formData = new FormData(roleUpdateForm);
      const targetUserId = String(formData.get("user_id") || "").trim();
      const targetUser = (state.users || []).find((user) => String(user.id || "") === targetUserId);
      if (String(targetUser?.role || "").trim().toUpperCase() === "SUPER_ADMIN") {
        state.error = "Super Admin role is fixed and cannot be changed";
        render();
        return;
      }
      try {
        await api("/api/users/update-role", {
          method: "POST",
          body: JSON.stringify({
            user_id: targetUserId,
            role: formData.get("role")
          })
        });
        await hydrateDashboard();
        render();
      } catch (error) {
        if (error.status === 404) {
          state.apiAvailability.updateRole = false;
          state.error = state.labels.roleUpdate.endpointMissing || "Role update endpoint is not available in current backend";
          render();
          return;
        }
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const loginControlsFilterForm = document.getElementById("login-controls-filter-form");
  if (loginControlsFilterForm) {
    loginControlsFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const scrollY = getScrollY();
      state.error = "";
      state.success = "";
      const formData = new FormData(loginControlsFilterForm);
      state.loginControlsUserId = String(formData.get("user_id") || "").trim();
      try {
        await hydrateLoginControls();
        render();
        restoreScrollY(scrollY);
      } catch (error) {
        state.error = error.message;
        render();
        restoreScrollY(scrollY);
      }
    });
  }

  const loginControlsAddForm = document.getElementById("login-controls-add-form");
  if (loginControlsAddForm) {
    loginControlsAddForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(loginControlsAddForm);
      const userId = state.loginControlsUserId;
      const systemName = String(formData.get("system_name") || "").trim();
      const macAddress = String(formData.get("mac_address") || "").trim();
      if (!userId) {
        state.error = "Select a user first";
        render();
        return;
      }
      try {
        await api("/api/login-controls/add", {
          method: "POST",
          body: JSON.stringify({
            user_id: userId,
            system_name: systemName,
            mac_address: macAddress
          })
        });
        await hydrateLoginControls();
        handleSuccessfulFormSubmission(loginControlsAddForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  document.querySelectorAll("[data-deactivate-control]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.error = "";
      state.success = "";
      const controlId = String(button.getAttribute("data-deactivate-control") || "").trim();
      if (!controlId) {
        return;
      }
      try {
        await api("/api/login-controls/deactivate", {
          method: "POST",
          body: JSON.stringify({ control_id: controlId })
        });
        await hydrateLoginControls();
        state.success = "Success";
        renderPreservingScroll();
      } catch (error) {
        state.error = error.message;
        renderPreservingScroll();
      }
    });
  });

  document.querySelectorAll("[data-analytics-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = String(button.getAttribute("data-analytics-section") || "").trim();
      if (!section || section === state.analyticsSection) {
        return;
      }
      state.analyticsSection = section;
      renderPreservingScroll();
    });
  });

  const analyticsFilterForm = document.getElementById("analytics-filter-form");
  if (analyticsFilterForm) {
    analyticsFilterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const scrollY = getScrollY();
      state.error = "";
      state.success = "";
      const formData = new FormData(analyticsFilterForm);
      state.analyticsFilters = {
        analytics_type: String(formData.get("analytics_type") || "all").trim(),
        group_by: String(formData.get("group_by") || "month").trim(),
        view_mode: String(formData.get("view_mode") || "simple").trim(),
        row_limit: String(formData.get("row_limit") || "50").trim().toLowerCase(),
        start_date: String(formData.get("start_date") || "").trim(),
        end_date: String(formData.get("end_date") || "").trim(),
        user_id: String(formData.get("user_id") || "").trim(),
        item_id: String(formData.get("item_id") || "").trim(),
        delivery_user_id: String(formData.get("delivery_user_id") || "").trim(),
        item_status: String(formData.get("item_status") || "all").trim().toUpperCase(),
        item_fill_state: String(formData.get("item_fill_state") || "all").trim().toUpperCase(),
        item_warning: String(formData.get("item_warning") || "all").trim().toLowerCase(),
        item_dc_link: String(state.analyticsFilters?.item_dc_link || "all").trim().toLowerCase(),
        user_role: String(formData.get("user_role") || "all").trim().toUpperCase()
      };
      try {
        await hydrateAnalytics();
        render();
        restoreScrollY(scrollY);
      } catch (error) {
        state.error = error.message;
        render();
        restoreScrollY(scrollY);
      }
    });
  }

  const analyticsExportBtn = document.getElementById("analytics-export-btn");
  if (analyticsExportBtn) {
    analyticsExportBtn.addEventListener("click", () => {
      if (!state.apiAvailability.analytics || state.analytics?.localFallback) {
        const exportRows = analyticsToExportRows(state.analytics || buildLocalAnalyticsResult());
        exportRowsAsCsv(exportRows, "analytics_export.csv");
        return;
      }
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(state.analyticsFilters || {})) {
        if (value) {
          params.set(key, String(value));
        }
      }
      window.open(`/api/analytics/export?${params.toString()}`, "_blank");
    });
  }

  document.querySelectorAll("[data-analytics-chip]").forEach((button) => {
    button.addEventListener("click", async () => {
      const scrollY = getScrollY();
      const token = String(button.getAttribute("data-analytics-chip") || "").trim();
      if (!token.includes(":")) {
        return;
      }
      const [key, valueRaw] = token.split(":", 2);
      const value = String(valueRaw || "").trim();
      if (!key) {
        return;
      }
      state.error = "";
      state.success = "";
      const normalizedValue = (() => {
        if (["item_warning", "item_dc_link", "group_by", "analytics_type", "view_mode", "row_limit"].includes(key)) {
          return value.toLowerCase();
        }
        return value.toUpperCase();
      })();
      const nextAnalyticsType = (() => {
        if (key.startsWith("item_")) {
          return "item";
        }
        if (key === "user_role") {
          return "user";
        }
        if (key === "group_by") {
          return "year";
        }
        return state.analyticsFilters.analytics_type;
      })();
      state.analyticsFilters = {
        ...state.analyticsFilters,
        analytics_type: nextAnalyticsType,
        [key]: normalizedValue
      };
      try {
        await hydrateAnalytics();
        render();
        restoreScrollY(scrollY);
      } catch (error) {
        state.error = error.message;
        render();
        restoreScrollY(scrollY);
      }
    });
  });

  const transitionStep1Form = document.getElementById("transition-step1-form");
  if (transitionStep1Form) {
    const proceedTransitionStep1 = (actionRaw) => {
      state.error = "";
      state.success = "";
      const action = String(actionRaw || "").trim().toUpperCase();
      if (!["TAKING", "GIVING"].includes(action)) {
        state.error = "Action must be TAKING or GIVING";
        render();
        return;
      }
      state.transitionFlow.action = action;
      state.transitionFlow.step = 2;
      state.transitionFlow.dispatchTargetType = action === "GIVING" ? "CUSTOMER" : "";
      state.transitionFlow.dispatchUserId = "";
      state.transitionFlow.dispatchUserQuery = "";
      state.transitionFlow.dispatchCustomerName = "";
      state.transitionFlow.sourceLocationId = "";
      state.transitionFlow.dcBookId = "";
      state.transitionFlow.linkDcRef = "";
      state.transitionFlow.selectedItemIds = [];
      state.transitionFlow.selectedItemStates = {};
      render();
    };

    transitionStep1Form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(transitionStep1Form);
      proceedTransitionStep1(formData.get("action"));
    });

    transitionStep1Form.querySelectorAll('input[name="action"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        proceedTransitionStep1(radio.value);
      });
    });
  }

  const transitionBack1 = document.getElementById("transition-back-1");
  if (transitionBack1) {
    transitionBack1.addEventListener("click", () => {
      state.error = "";
      state.transitionFlow.step = 1;
      render();
    });
  }

  const transitionStep2Form = document.getElementById("transition-step2-form");
  if (transitionStep2Form) {
    const proceedTransitionStep2 = async (sourceTypeRaw, sourceUserIdRaw, sourceLocationIdRaw) => {
      state.error = "";
      state.success = "";
      const sourceType = String(sourceTypeRaw || "").trim().toUpperCase();
      const sourceUserId = String(sourceUserIdRaw || "").trim();
      const sourceLocationId = String(sourceLocationIdRaw || "").trim();
      if (!["SELF", "EMPLOYEE", "FILLER", "CUSTOMER", "TRANSIT"].includes(sourceType)) {
        state.error = "Invalid source type";
        render();
        return;
      }
      const allowedSourcesByAction = {
        TAKING: new Set((transitionAllowedSourcesByRole[currentUserRole]?.TAKING || ["SELF"])),
        GIVING: new Set((transitionAllowedSourcesByRole[currentUserRole]?.GIVING || ["SELF"]))
      };
      const currentAction = String(state.transitionFlow.action || "").toUpperCase();
      const allowedSources = allowedSourcesByAction[currentAction] || new Set();
      if (!allowedSources.has(sourceType)) {
        state.error = `Source ${sourceType} is not allowed for action ${currentAction}`;
        render();
        return;
      }
      const ownSourceType = transitionRoleOwnSource[currentUserRole] || "";
      if (ownSourceType && sourceType === ownSourceType && sourceUserId && sourceUserId !== currentUserId) {
        state.error = `Source ${sourceType} is restricted to your own account`;
        render();
        return;
      }
      if ((sourceType === "EMPLOYEE" || sourceType === "FILLER" || sourceType === "CUSTOMER") && !sourceUserId) {
        state.error = sourceType === "CUSTOMER"
          ? "Please select a customer source"
          : sourceType === "FILLER"
            ? "Please select a filler source"
          : "Please select an employee source";
        render();
        return;
      }
      if (sourceType === "SELF") {
        const activeCompanyLocations = (state.companyLocations || []).filter((loc) => Boolean(loc?.is_active));
        if (activeCompanyLocations.length > 1 && !sourceLocationId) {
          state.error = "Please select company location";
          render();
          return;
        }
      }
      if (sourceType === "CUSTOMER") {
        const customerLocations = (state.customerLocations || [])
          .filter((loc) => String(loc.user_id || "").trim() === sourceUserId)
          .filter((loc) => loc.is_active === undefined || loc.is_active === null || Boolean(loc.is_active));
        if (customerLocations.length > 1 && !sourceLocationId) {
          state.error = "Please select customer location";
          render();
          return;
        }
      }
      state.transitionFlow.sourceType = sourceType;
      state.transitionFlow.sourceUserId = sourceUserId;
      state.transitionFlow.sourceLocationId = sourceType === "CUSTOMER" || sourceType === "SELF" ? sourceLocationId : "";
      try {
        await hydrateTransitionItems();
        state.transitionFlow.selectedItemIds = [];
        state.transitionFlow.selectedItemStates = {};
        if (currentAction === "GIVING") {
          await hydrateTransitionDcBooks();
          state.transitionDcLinks = [];
          state.transitionFlow.linkDcRef = "";
        } else {
          state.transitionDcBooks = [];
          state.transitionFlow.dcBookId = "";
          await hydrateTransitionDcLinks();
        }
        state.transitionFlow.step = 3;
        render();
      } catch (error) {
        state.error = error.message;
        render();
      }
    };

    transitionStep2Form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(transitionStep2Form);
      await proceedTransitionStep2(formData.get("source_type"), formData.get("source_user_id"), formData.get("source_location_id"));
    });

    transitionStep2Form.querySelectorAll('input[name="source_type"]').forEach((radio) => {
      radio.addEventListener("change", async () => {
        const selectedSource = String(radio.value || "").toUpperCase();
        if (selectedSource === "SELF") {
          const activeCompanyLocations = (state.companyLocations || []).filter((loc) => Boolean(loc?.is_active));
          if (activeCompanyLocations.length > 1) {
            state.transitionFlow.sourceType = selectedSource;
            state.transitionFlow.sourceUserId = "";
            state.transitionFlow.sourceLocationId = "";
            render();
            return;
          }
          const resolvedLocationId = activeCompanyLocations.length === 1 ? String(activeCompanyLocations[0].id || "").trim() : "";
          await proceedTransitionStep2(radio.value, "", resolvedLocationId);
          return;
        }
        if (selectedSource === "EMPLOYEE" || selectedSource === "FILLER" || selectedSource === "CUSTOMER") {
          state.transitionFlow.sourceType = selectedSource;
          state.transitionFlow.sourceUserId = "";
          state.transitionFlow.sourceLocationId = "";
          render();
          return;
        }
        await proceedTransitionStep2(radio.value, "", "");
      });
    });

    const sourceUserSelect = transitionStep2Form.querySelector('select[name="source_user_id"]');
    if (sourceUserSelect) {
      sourceUserSelect.addEventListener("change", async () => {
        if (!String(sourceUserSelect.value || "").trim()) {
          return;
        }
        if (String(state.transitionFlow.sourceType || "").toUpperCase() === "CUSTOMER") {
          const selectedCustomerId = String(sourceUserSelect.value || "").trim();
          const customerLocations = (state.customerLocations || [])
            .filter((loc) => String(loc.user_id || "").trim() === selectedCustomerId)
            .filter((loc) => loc.is_active === undefined || loc.is_active === null || Boolean(loc.is_active));
          if (customerLocations.length > 1) {
            state.transitionFlow.sourceUserId = selectedCustomerId;
            state.transitionFlow.sourceLocationId = "";
            render();
            return;
          }
          const resolvedLocationId = customerLocations.length === 1 ? String(customerLocations[0].id || "").trim() : "";
          state.transitionFlow.sourceLocationId = "";
          await proceedTransitionStep2("CUSTOMER", selectedCustomerId, resolvedLocationId);
          return;
        }
        await proceedTransitionStep2(state.transitionFlow.sourceType, sourceUserSelect.value, "");
      });
    }

    const sourceLocationSelect = transitionStep2Form.querySelector('select[name="source_location_id"]');
    if (sourceLocationSelect) {
      sourceLocationSelect.addEventListener("change", async () => {
        if (!String(sourceLocationSelect.value || "").trim()) {
          return;
        }
        await proceedTransitionStep2(state.transitionFlow.sourceType, state.transitionFlow.sourceUserId, sourceLocationSelect.value);
      });
    }
  }

  const transitionBack2 = document.getElementById("transition-back-2");
  if (transitionBack2) {
    transitionBack2.addEventListener("click", () => {
      state.error = "";
      state.transitionFlow.step = 2;
      render();
    });
  }

  const transitionSubmitForm = document.getElementById("transition-submit-form");
  if (transitionSubmitForm) {
    const isLinkedTakingActive = () => {
      const action = String(state.transitionFlow.action || "").toUpperCase();
      if (action !== "TAKING") {
        return false;
      }
      const linkSelect = transitionSubmitForm.querySelector('select[name="link_dc_ref"]');
      return String(linkSelect?.value || "").trim().length > 0;
    };

    const forceLinkedTakingStatesToEmpty = () => {
      if (!isLinkedTakingActive()) {
        return;
      }
      Array.from(state.transitionFlow.selectedItemIds || []).forEach((itemIdRaw) => {
        const itemId = String(itemIdRaw || "").trim();
        if (!itemId) {
          return;
        }
        state.transitionFlow.selectedItemStates[itemId] = "EMPTY";
        setFillStateFieldValue(transitionSubmitForm, `item_state_${itemId}`, "EMPTY");
      });
    };

    transitionSubmitForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";

      const selectedItems = Array.from(state.transitionFlow.selectedItemIds || []).map((value) => String(value || "")).filter(Boolean);

      if (selectedItems.length === 0) {
        state.error = "Select at least one item";
        render();
        return;
      }

      const itemUpdates = selectedItems.map((itemId) => {
        const stateInputName = `item_state_${itemId}`;
        const stateRadio = transitionSubmitForm.querySelector(`input[type="radio"][name="${stateInputName}"]:checked`);
        const stateSelect = transitionSubmitForm.querySelector(`select[name="${stateInputName}"]`);
        const storedState = String((state.transitionFlow.selectedItemStates || {})[itemId] || "").toUpperCase();
        const resolvedState = (stateRadio || stateSelect)
          ? String((stateRadio ? stateRadio.value : stateSelect?.value) || "EMPTY").toUpperCase()
          : (storedState === "FULL" || storedState === "EMPTY" ? storedState : "EMPTY");
        return {
          item_id: itemId,
          fill_state: resolvedState
        };
      });

      const formData = new FormData(transitionSubmitForm);
      const dcBookId = String(formData.get("dc_book_id") || "").trim();
      const linkDcRef = String(formData.get("link_dc_ref") || "").trim();
      const action = String(state.transitionFlow.action || "").toUpperCase();
      const dispatchTargetType = action === "GIVING" ? "CUSTOMER" : "";
      const dispatchUserId = "";
      const dispatchUserQuery = "";
      const dispatchCustomerName = action === "GIVING"
        ? String(formData.get("dispatch_customer_name") || "").trim()
        : "";
      state.transitionFlow.dcBookId = dcBookId;
      state.transitionFlow.linkDcRef = linkDcRef;
      state.transitionFlow.dispatchTargetType = dispatchTargetType;
      state.transitionFlow.dispatchUserId = dispatchUserId;
      state.transitionFlow.dispatchUserQuery = dispatchUserQuery;
      state.transitionFlow.dispatchCustomerName = dispatchCustomerName;
      if (action === "GIVING") {
        if (dispatchCustomerName.length < 2) {
          state.error = "Enter customer name";
          render();
          return;
        }
      }
      const hasFullItems = itemUpdates.some((entry) => entry.fill_state === "FULL");
      const dcRequired = action === "GIVING"
        && hasFullItems
        && dispatchTargetType === "CUSTOMER"
        && state.user?.role !== "FILLER"
        && String(state.transitionFlow.sourceType || "").toUpperCase() !== "SELF";
      if (dcRequired && !dcBookId) {
        state.error = "Select a DC book for GIVING with FULL-state items";
        render();
        return;
      }
      let linkDcBookId = "";
      let linkDcNumber = "";
      if (linkDcRef) {
        itemUpdates.forEach((entry) => {
          entry.fill_state = "EMPTY";
          if (entry.item_id) {
            state.transitionFlow.selectedItemStates[String(entry.item_id)] = "EMPTY";
          }
        });
        const [bookPart, numberPart] = linkDcRef.split("::");
        linkDcBookId = String(bookPart || "").trim();
        linkDcNumber = String(numberPart || "").trim();
        if (!linkDcBookId || !/^\d+$/.test(linkDcNumber)) {
          state.error = "Invalid linked DC reference";
          render();
          return;
        }
        const hasNonEmptyItems = itemUpdates.some((entry) => entry.fill_state !== "EMPTY");
        if (hasNonEmptyItems) {
          state.error = "Linked TAKING is allowed only when all selected items are EMPTY";
          render();
          return;
        }
      }

      try {
        const currentProcessId = String(state.transitionFlow.processId || "").trim();
        const requestBody = {
          action: state.transitionFlow.action,
          source_type: state.transitionFlow.sourceType,
          source_user_id: state.transitionFlow.sourceUserId,
          source_location_id: state.transitionFlow.sourceLocationId,
          process_id: currentProcessId,
          dc_book_id: dcBookId,
          link_dc_book_id: linkDcBookId,
          link_dc_number: linkDcNumber,
          item_updates: itemUpdates
        };
        if (action === "GIVING") {
          requestBody.dispatch_target_type = dispatchTargetType;
          requestBody.dispatch_user_id = dispatchUserId;
          requestBody.dispatch_customer_name = dispatchCustomerName;
        }
        const result = await api("/api/transition/submit", {
          method: "POST",
          body: JSON.stringify(requestBody)
        });
        await hydrateDashboard();
        await hydrateTransitionProcesses();
        const resolvedProcessId = String(result.process_id || currentProcessId || "").trim();
        state.success = "Success";

        if (resolvedProcessId) {
          state.transitionFlow.pendingProcessId = resolvedProcessId;
          state.transitionFlow.pendingAction = String(state.transitionFlow.action || "TAKING").trim().toUpperCase();
          state.transitionFlow.step = 4;
          state.view = "transition";
          render();
          return;
        }

        resetTransitionFlow();
        state.view = "items-list";
        render();
      } catch (error) {
        state.error = error.message;
        render();
      }
    });

    const syncSelectedItemStateFromForm = () => {
      Array.from(state.transitionFlow.selectedItemIds || []).forEach((itemIdRaw) => {
        const itemId = String(itemIdRaw || "");
        if (!itemId) {
          return;
        }
        const stateInputName = `item_state_${itemId}`;
        const stateRadio = transitionSubmitForm.querySelector(`input[type="radio"][name="${stateInputName}"]:checked`);
        const stateSelect = transitionSubmitForm.querySelector(`select[name="${stateInputName}"]`);
        if (!stateRadio && !stateSelect) {
          return;
        }
        state.transitionFlow.selectedItemStates[itemId] = String((stateRadio ? stateRadio.value : stateSelect?.value) || "EMPTY").toUpperCase();
      });
    };

    transitionSubmitForm.querySelectorAll("[data-transition-select-item]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        syncSelectedItemStateFromForm();
        const itemId = String(checkbox.getAttribute("data-transition-select-item") || "").trim();
        if (!itemId) {
          return;
        }
        if (checkbox.checked && !state.transitionFlow.selectedItemIds.includes(itemId)) {
          state.transitionFlow.selectedItemIds.push(itemId);
          const item = (state.transitionItems || []).find((entry) => String(entry.id || "") === itemId);
          const sourceDefaultState = getTransitionDefaultFillStateBySource();
          state.transitionFlow.selectedItemStates[itemId] = isLinkedTakingActive()
            ? "EMPTY"
            : (sourceDefaultState === "FULL" || sourceDefaultState === "EMPTY")
            ? sourceDefaultState
            : (String(item?.fill_state || "EMPTY").toUpperCase() === "FULL" ? "FULL" : "EMPTY");
        } else if (!checkbox.checked) {
          state.transitionFlow.selectedItemIds = (state.transitionFlow.selectedItemIds || []).filter((value) => String(value || "") !== itemId);
          delete state.transitionFlow.selectedItemStates[itemId];
        }
        forceLinkedTakingStatesToEmpty();
        renderPreservingScroll();
      });
    });

    transitionSubmitForm.querySelectorAll("[data-transition-remove-item]").forEach((button) => {
      button.addEventListener("click", () => {
        syncSelectedItemStateFromForm();
        const itemId = String(button.getAttribute("data-transition-remove-item") || "").trim();
        if (!itemId) {
          return;
        }
        state.transitionFlow.selectedItemIds = (state.transitionFlow.selectedItemIds || []).filter((value) => String(value || "") !== itemId);
        delete state.transitionFlow.selectedItemStates[itemId];
        renderPreservingScroll();
      });
    });

    transitionSubmitForm.querySelectorAll('[name^="item_state_"]').forEach((field) => {
      field.addEventListener("change", () => {
        if (isLinkedTakingActive()) {
          forceLinkedTakingStatesToEmpty();
          renderPreservingScroll();
          return;
        }
        const itemId = String(field.getAttribute("name") || "").replace("item_state_", "").trim();
        if (!itemId) {
          return;
        }
        if (field instanceof HTMLInputElement && field.type === "radio") {
          const sameName = transitionSubmitForm.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
          sameName.forEach((radio) => {
            const option = radio.closest(".transition-action-option");
            if (option) {
              option.classList.toggle("active", radio.checked);
            }
          });
          if (!field.checked) {
            return;
          }
        }
        const fieldValue = "value" in field ? String(field.value || "EMPTY") : "EMPTY";
        state.transitionFlow.selectedItemStates[itemId] = fieldValue.toUpperCase();
      });
    });

    const linkDcSelect = transitionSubmitForm.querySelector('select[name="link_dc_ref"]');
    if (linkDcSelect) {
      linkDcSelect.addEventListener("change", () => {
        state.transitionFlow.linkDcRef = String(linkDcSelect.value || "").trim();
        forceLinkedTakingStatesToEmpty();
        renderPreservingScroll();
      });
    }

    const dispatchCustomerInput = transitionSubmitForm.querySelector('input[name="dispatch_customer_name"]');
    if (dispatchCustomerInput) {
      dispatchCustomerInput.addEventListener("input", () => {
        state.transitionFlow.dispatchCustomerName = String(dispatchCustomerInput.value || "").trim();
      });
      dispatchCustomerInput.addEventListener("change", () => {
        state.transitionFlow.dispatchCustomerName = String(dispatchCustomerInput.value || "").trim();
      });
    }
  }

  const transitionContinueYes = document.getElementById("transition-continue-yes");
  if (transitionContinueYes) {
    transitionContinueYes.addEventListener("click", async () => {
      const pendingProcessId = String(state.transitionFlow.pendingProcessId || "").trim();
      if (!pendingProcessId) {
        resetTransitionFlow();
        state.view = "items-list";
        render();
        return;
      }
      state.transitionFlow.processId = pendingProcessId;
      state.transitionFlow.pendingProcessId = "";
      const pendingAction = String(state.transitionFlow.pendingAction || "TAKING").toUpperCase();
      state.transitionFlow.pendingAction = "";
      const continueFromTransit = pendingAction === "TAKING";
      state.transitionFlow.action = continueFromTransit ? "GIVING" : (["TAKING", "GIVING"].includes(pendingAction) ? pendingAction : "TAKING");
      state.transitionFlow.step = continueFromTransit ? 3 : 2;
      state.transitionFlow.sourceType = continueFromTransit ? "TRANSIT" : "";
      state.transitionFlow.sourceUserId = "";
      state.transitionFlow.sourceLocationId = "";
      state.transitionFlow.dispatchTargetType = state.transitionFlow.action === "GIVING" ? "CUSTOMER" : "";
      state.transitionFlow.dispatchUserId = "";
      state.transitionFlow.dispatchUserQuery = "";
      state.transitionFlow.dispatchCustomerName = "";
      state.transitionFlow.dcBookId = "";
      state.transitionFlow.linkDcRef = "";
      state.transitionFlow.selectedItemIds = [];
      state.transitionFlow.selectedItemStates = {};
      state.transitionItems = [];
      state.transitionDcBooks = [];
      state.transitionDcLinks = [];
      state.view = "transition";
      try {
        if (continueFromTransit) {
          await hydrateTransitionItems();
          await hydrateTransitionDcBooks();
        }
        render();
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const transitionContinueNo = document.getElementById("transition-continue-no");
  if (transitionContinueNo) {
    transitionContinueNo.addEventListener("click", () => {
      resetTransitionFlow();
      state.view = "items-list";
      render();
    });
  }

  const profileForm = document.getElementById("profile-form");
  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(profileForm);
      const securityKeys = readSecurityKeys(formData);
      const securityError = validateSecurityKeysInput(securityKeys);
      if (securityError) {
        state.error = securityError;
        render();
        return;
      }
      try {
        await api("/api/profile/update", {
          method: "POST",
          body: JSON.stringify({
            full_name: formData.get("full_name"),
            email: formData.get("email"),
            current_password: formData.get("current_password"),
            new_password: formData.get("new_password"),
            security_key_1: securityKeys.key1,
            security_key_2: securityKeys.key2,
            security_key_3: securityKeys.key3
          })
        });
        await hydrateProfile();
        state.user = { ...state.user, full_name: state.profile.full_name, email: state.profile.email };
        handleSuccessfulFormSubmission(profileForm);
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const adminPasswordResetForm = document.getElementById("admin-password-reset-form");
  if (adminPasswordResetForm) {
    adminPasswordResetForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(adminPasswordResetForm);
      try {
        await api("/api/admin/password-reset", {
          method: "POST",
          body: JSON.stringify({
            current_password: formData.get("current_password"),
            new_password: formData.get("new_password"),
            confirm_password: formData.get("confirm_password")
          })
        });
        handleSuccessfulFormSubmission(adminPasswordResetForm);
      } catch (error) {
        state.error = error.message;
        state.success = "";
        render();
      }
    });
  }

  const backupMonthlyForm = document.getElementById("backup-monthly-form");
  bindFormAction(backupMonthlyForm, async () => {
    await api("/api/backups/export", {
      method: "POST",
      body: JSON.stringify({ backup_kind: "MONTHLY" })
    });
    await hydrateBackups();
  });

  const backupAnnualForm = document.getElementById("backup-annual-form");
  bindFormAction(backupAnnualForm, async () => {
    await api("/api/backups/export", {
      method: "POST",
      body: JSON.stringify({ backup_kind: "ANNUAL" })
    });
    await hydrateBackups();
  });

  const backupUserForm = document.getElementById("backup-user-form");
  bindFormAction(backupUserForm, async (formData) => {
    const targetUserId = String(formData.get("target_user_id") || "").trim();
    if (!targetUserId) {
      renderWithError(state.labels.backups.targetUserRequired);
      return;
    }
    await api("/api/backups/export", {
      method: "POST",
      body: JSON.stringify({ backup_kind: "USER", target_user_id: targetUserId })
    });
    await hydrateBackups();
  });

  const backupFullForm = document.getElementById("backup-full-form");
  bindFormAction(backupFullForm, async () => {
    await api("/api/backups/export", {
      method: "POST",
      body: JSON.stringify({ backup_kind: "FULL" })
    });
    await hydrateBackups();
  });

  document.querySelectorAll("[data-download-backup]").forEach((button) => {
    button.addEventListener("click", () => {
      const fileName = String(button.getAttribute("data-download-backup") || "").trim();
      if (!fileName) {
        return;
      }
      window.open(`/api/backups/download?file_name=${encodeURIComponent(fileName)}`, "_blank");
      state.success = "Success";
      state.error = "";
      render();
    });
  });

  const backupImportForm = document.getElementById("backup-import-form");
  if (backupImportForm) {
    backupImportForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      resetFeedback();
      const formData = new FormData(backupImportForm);
      const importMode = String(formData.get("import_mode") || "MERGE").trim().toUpperCase();
      const fileName = String(formData.get("file_name") || "").trim();
      const fileInput = backupImportForm.querySelector('input[name="backup_file"]');
      const uploadedFile = fileInput?.files?.[0] || null;
      if (fileName && uploadedFile) {
        renderWithError(state.labels.backups.chooseOneSource);
        return;
      }
      if (!fileName && !uploadedFile) {
        renderWithError(state.labels.backups.pickBackupSource);
        return;
      }

      try {
        const payload = { import_mode: importMode };
        if (uploadedFile) {
          payload.file_content = await uploadedFile.text();
          payload.source_name = uploadedFile.name || "uploaded-backup.json";
        } else {
          payload.file_name = fileName;
        }
        const result = await api("/api/backups/import", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (result.reauth_required) {
          state.success = "Success";
          state.error = "";
          state.user = null;
          state.profile = null;
          state.backups = [];
          render();
          return;
        }
        await hydrateDashboard();
        handleSuccessfulFormSubmission(backupImportForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const superAdminRefreshBtn = document.getElementById("super-admin-refresh");
  document.querySelectorAll("[data-super-admin-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = String(button.getAttribute("data-super-admin-section") || "").trim();
      if (!section || section === state.superAdminSection) {
        return;
      }
      state.superAdminSection = section;
      renderPreservingScroll();
    });
  });
  bindClickAction(superAdminRefreshBtn, async () => {
    await hydrateSuperAdminStats();
    render();
  });

  const superAdminDeleteItemForm = document.getElementById("super-admin-delete-item-form");
  bindFormAction(superAdminDeleteItemForm, async (formData) => {
    await api("/api/super-admin/delete-item", {
      method: "POST",
      body: JSON.stringify({ item_id: String(formData.get("item_id") || "").trim() })
    });
    await hydrateDashboard();
  });

  const superAdminDeleteUserForm = document.getElementById("super-admin-delete-user-form");
  bindFormAction(superAdminDeleteUserForm, async (formData) => {
    await api("/api/super-admin/delete-user", {
      method: "POST",
      body: JSON.stringify({ user_id: String(formData.get("user_id") || "").trim() })
    });
    await hydrateDashboard();
  });

  const superAdminResetTableForm = document.getElementById("super-admin-reset-table-form");
  bindFormAction(superAdminResetTableForm, async (formData) => {
    await api("/api/super-admin/reset-table", {
      method: "POST",
      body: JSON.stringify({ table_name: String(formData.get("table_name") || "").trim() })
    });
    await hydrateDashboard();
  });

  const superAdminClearAllForm = document.getElementById("super-admin-clear-all-form");
  if (superAdminClearAllForm) {
    superAdminClearAllForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(superAdminClearAllForm);
      const reason = String(formData.get("reason") || "").trim();
      const confirmText = String(formData.get("confirm_text") || "").trim();
      if (reason.length < 3 || reason.length > 500) {
        state.error = "Provide a reason between 3 and 500 characters";
        render();
        return;
      }
      if (confirmText !== "CONFIRM") {
        state.error = "Type CONFIRM exactly to clear all data";
        render();
        return;
      }
      try {
        await api("/api/super-admin/clear-all-data", {
          method: "POST",
          body: JSON.stringify({ confirm_text: confirmText, reason })
        });
        await hydrateDashboard();
        handleSuccessfulFormSubmission(superAdminClearAllForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  // Load and render category rules table
  async function loadCategoryRules() {
    try {
      const response = await api("/api/item-categories");
      const categories = response.data || [];
      const tbody = document.getElementById("super-admin-categories-tbody");
      if (!tbody) return;
      
      if (categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="muted">${escapeHtml(state.labels.superAdmin.noCategoryRules)}</td></tr>`;
        return;
      }
      
      tbody.innerHTML = categories.map(cat => `
        <tr>
          <td>${escapeHtml(cat.item_type || "-")}</td>
          <td>${escapeHtml(cat.category_name)}</td>
          <td>${escapeHtml(cat.code_prefix)}</td>
          <td>${cat.prefixes ? cat.prefixes.length : 1}</td>
          <td>${cat.range_start !== null && cat.range_end !== null ? `${cat.range_start}-${cat.range_end}` : state.labels.superAdmin.noRange}</td>
          <td>${cat.is_active ? "✓" : "○"}</td>
          <td>
            <button type="button" class="category-edit-btn" data-category-key="${escapeHtml(cat.category_key)}" style="cursor: pointer;">Edit</button>
            <button type="button" class="category-delete-btn" data-category-key="${escapeHtml(cat.category_key)}" data-category-name="${escapeHtml(cat.category_name)}" style="cursor: pointer; color: #d9534f;">Delete</button>
          </td>
        </tr>
      `).join("");
      
      // Attach edit button handlers
      document.querySelectorAll(".category-edit-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const categoryKey = btn.getAttribute("data-category-key");
          const category = categories.find(c => c.category_key === categoryKey);
          if (!category) return;

          const categoryTypeSelect = document.getElementById("category-type-select");
          const categoryNameInput = document.getElementById("category-name-input");
          const categoryEditKeyInput = document.getElementById("category-edit-key");
          if (categoryTypeSelect) {
            categoryTypeSelect.value = String(category.item_type || "CONTAINER");
          }
          if (categoryNameInput) {
            categoryNameInput.value = String(category.category_name || "");
          }
          if (categoryEditKeyInput) {
            categoryEditKeyInput.value = String(category.category_key || "");
          }
          document.getElementById("category-prefix-input").value = category.code_prefix;
          document.getElementById("category-prefixes-input").value = category.prefixes ? category.prefixes.join(",") : category.code_prefix;
          document.getElementById("category-range-start-input").value = category.range_start || "";
          document.getElementById("category-range-end-input").value = category.range_end || "";
          document.getElementById("category-is-active-input").checked = category.is_active;
          const categoryIsActiveText = document.getElementById("category-is-active-text");
          if (categoryIsActiveText) {
            categoryIsActiveText.textContent = category.is_active
              ? (state.labels.common.yes || "Yes")
              : (state.labels.common.no || "No");
          }
          
          // Scroll to form
          document.getElementById("super-admin-category-form").scrollIntoView({ behavior: "smooth" });
        });
      });
      
      // Attach delete button handlers
      document.querySelectorAll(".category-delete-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const categoryKey = String(btn.getAttribute("data-category-key") || "").trim();
          const categoryName = btn.getAttribute("data-category-name");
          if (!confirm(`Delete category "${categoryName}"?`)) return;
          
          state.error = "";
          state.success = "";
          try {
            await api("/api/super-admin/item-categories/delete", {
              method: "DELETE",
              body: JSON.stringify({ category_key: categoryKey, category_name: categoryName })
            });
            state.success = "Success";
            await loadCategoryRules();
            render();
          } catch (error) {
            state.error = error.message;
            render();
          }
        });
      });
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  }

  async function loadVolumeUnits() {
    try {
      const response = await api("/api/volume-units");
      const units = Array.isArray(response.data) ? response.data : [];
      state.volumeUnits = units
        .map((row) => normalizeVolumeUnitClient(row?.unit_name))
        .filter((value, index, arr) => value && arr.indexOf(value) === index);
      const tbody = document.getElementById("super-admin-volume-units-tbody");
      if (!tbody) {
        return;
      }
      if (units.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="muted">${escapeHtml(state.labels.superAdmin.noVolumeUnits || "No volume units found")}</td></tr>`;
        return;
      }
      tbody.innerHTML = units
        .map(
          (entry) => `
            <tr>
              <td>${escapeHtml(entry.unit_name || "-")}</td>
              <td>
                <button type="button" class="volume-unit-delete-btn" data-volume-unit="${escapeHtml(entry.unit_name || "")}" style="cursor: pointer; color: #d9534f;">${escapeHtml(state.labels.superAdmin.delete || "Delete")}</button>
              </td>
            </tr>
          `,
        )
        .join("");

      document.querySelectorAll(".volume-unit-delete-btn").forEach((button) => {
        button.addEventListener("click", async () => {
          const unitName = String(button.getAttribute("data-volume-unit") || "").trim();
          if (!unitName) {
            return;
          }
          if (!confirm(`Delete volume unit "${unitName}"?`)) {
            return;
          }
          state.error = "";
          state.success = "";
          try {
            await api("/api/super-admin/volume-units/delete", {
              method: "DELETE",
              body: JSON.stringify({ unit_name: unitName }),
            });
            state.success = "Success";
            await loadVolumeUnits();
            render();
          } catch (error) {
            state.error = error.message;
            render();
          }
        });
      });
    } catch (error) {
      console.error("Failed to load volume units:", error);
    }
  }

  const superAdminCategoryForm = document.getElementById("super-admin-category-form");
  if (superAdminCategoryForm) {
    const categoryTypeSelect = document.getElementById("category-type-select");
    const categoryNameInput = document.getElementById("category-name-input");
    const categoryNameOptions = document.getElementById("category-name-options");
    const categoryEditKeyInput = document.getElementById("category-edit-key");
    const categoryIsActiveInput = document.getElementById("category-is-active-input");
    const categoryIsActiveText = document.getElementById("category-is-active-text");
    const syncCategoryNameOptions = () => {
      if (!categoryNameOptions) {
        return;
      }
      const selectedType = String(categoryTypeSelect?.value || "").trim().toUpperCase();
      categoryNameOptions.innerHTML = getCategoryNamesForItemType(selectedType)
        .map((value) => `<option value="${escapeHtml(value)}"></option>`)
        .join("");
    };
    if (categoryTypeSelect) {
      categoryTypeSelect.addEventListener("change", syncCategoryNameOptions);
      syncCategoryNameOptions();
    }
    const syncCategoryIsActiveText = () => {
      if (!categoryIsActiveInput || !categoryIsActiveText) {
        return;
      }
      categoryIsActiveText.textContent = categoryIsActiveInput.checked
        ? (state.labels.common.yes || "Yes")
        : (state.labels.common.no || "No");
    };
    if (categoryIsActiveInput) {
      categoryIsActiveInput.addEventListener("change", syncCategoryIsActiveText);
      syncCategoryIsActiveText();
    }

    superAdminCategoryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(superAdminCategoryForm);
      
      try {
        const categoryType = String(formData.get("category_type") || "").trim().toUpperCase();
        const categoryName = String(formData.get("category_name") || "").trim();
        const categoryKey = String(formData.get("category_key") || "").trim();
        const codePrefix = String(formData.get("code_prefix") || "").trim();
        const prefixesStr = String(formData.get("prefixes") || "").trim();
        const rangeStart = String(formData.get("range_start") || "").trim();
        const rangeEnd = String(formData.get("range_end") || "").trim();
        const isActive = formData.get("is_active") === "on";
        
        if (!categoryName) {
          state.error = "Category name is required";
          render();
          return;
        }
        if (!ITEM_TYPE_SET.has(categoryType)) {
          state.error = "Category type must be CONTAINER, CYLINDER, or OTHER";
          render();
          return;
        }
        if (!codePrefix) {
          state.error = "Code prefix is required";
          render();
          return;
        }
        
        // Parse prefixes from comma-separated string
        const prefixes = prefixesStr
          .split(",")
          .map(p => p.trim())
          .filter(p => p.length > 0);
        const normalizedPrefixes = prefixes.length > 0 ? prefixes : [codePrefix];
        
        // Validate ranges
        if (rangeStart || rangeEnd) {
          const start = rangeStart ? parseInt(rangeStart, 10) : null;
          const end = rangeEnd ? parseInt(rangeEnd, 10) : null;
          if (start !== null && end !== null && start > end) {
            state.error = "Range start must be less than or equal to range end";
            render();
            return;
          }
        }
        
        const payload = {
          category_name: categoryName,
          category_type: categoryType,
          code_prefix: codePrefix,
          prefixes: normalizedPrefixes,
          is_active: isActive
        };

        if (categoryKey) {
          payload.category_key = categoryKey;
        }
        
        if (rangeStart) payload.range_start = parseInt(rangeStart, 10);
        if (rangeEnd) payload.range_end = parseInt(rangeEnd, 10);
        
        const result = await api("/api/super-admin/item-categories/upsert", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        handleSuccessfulFormSubmission(superAdminCategoryForm);
        if (categoryEditKeyInput) {
          categoryEditKeyInput.value = "";
        }
        syncCategoryNameOptions();
        await loadCategoryRules();
        document.getElementById("super-admin-category-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        state.error = error.message;
        render();
        document.getElementById("super-admin-category-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    
    // Load categories on page render
    loadCategoryRules();
  }

  const superAdminVolumeUnitForm = document.getElementById("super-admin-volume-unit-form");
  if (superAdminVolumeUnitForm) {
    superAdminVolumeUnitForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(superAdminVolumeUnitForm);
      const unitName = normalizeVolumeUnitClient(formData.get("unit_name"));
      if (unitName.length < 2 || unitName.length > 40) {
        state.error = "Volume unit must be between 2 and 40 characters";
        render();
        return;
      }
      try {
        await api("/api/super-admin/volume-units/upsert", {
          method: "POST",
          body: JSON.stringify({ unit_name: unitName }),
        });
        handleSuccessfulFormSubmission(superAdminVolumeUnitForm);
        await loadVolumeUnits();
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
    loadVolumeUnits();
  }

  async function loadDcBooks() {
    try {
      const response = await api("/api/super-admin/dc-books");
      const books = response.data || [];
      const tbody = document.getElementById("super-admin-dc-books-tbody");
      if (!tbody) {
        return;
      }
      const searchFilter = String(state.superAdminDcBookFilter || "").trim().toLowerCase();
      const activeFilter = String(state.superAdminDcBookActiveFilter || "all").trim().toLowerCase();
      const filteredBooks = books.filter((book) => {
        if (activeFilter === "active" && !book.is_active) {
          return false;
        }
        if (activeFilter === "inactive" && book.is_active) {
          return false;
        }
        if (!searchFilter) {
          return true;
        }
        const haystack = [book.book_id, `${book.range_start}-${book.range_end}`, book.next_dc_number]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return haystack.includes(searchFilter);
      });
      if (filteredBooks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="muted">${escapeHtml(state.labels.superAdmin.noDcBooks || "No DC books found")}</td></tr>`;
        return;
      }
      tbody.innerHTML = filteredBooks
        .map(
          (book) => `
            <tr>
              <td>${escapeHtml(book.book_id)}</td>
              <td>${escapeHtml(`${book.range_start}-${book.range_end}`)}</td>
              <td>${escapeHtml(book.next_dc_number)}</td>
              <td>${escapeHtml(book.remaining)}</td>
              <td>${book.is_active ? "✓" : "○"}</td>
              <td><button type="button" class="dc-book-view-btn" data-book-id="${escapeHtml(book.book_id)}">${escapeHtml(state.labels.superAdmin.edit || "View")}</button></td>
            </tr>
          `
        )
        .join("");
      document.querySelectorAll(".dc-book-view-btn").forEach((button) => {
        button.addEventListener("click", async () => {
          const bookId = String(button.getAttribute("data-book-id") || "").trim();
          if (!bookId) {
            return;
          }
          await loadDcBookDetails(bookId);
        });
      });
    } catch (error) {
      console.error("Failed to load DC books:", error);
    }
  }

  function renderDcBookDetails() {
    const container = document.getElementById("super-admin-dc-book-details");
    if (!container) {
      return;
    }
    const details = state.superAdminDcBookDetails;
    if (!details || !details.book) {
      container.innerHTML = `<p class="muted">Select a DC book to view analytics and records.</p>`;
      return;
    }
    const book = details.book;
    const summary = details.summary || {};
    const searchFilter = String(state.superAdminDcBookRecordSearch || "").trim().toLowerCase();
    const statusFilter = String(state.superAdminDcBookRecordStatusFilter || "all").trim().toUpperCase();
    const numberFilter = String(state.superAdminDcBookRecordNumberFilter || "").trim();
    const records = (details.records || []).filter((record) => {
      if (statusFilter !== "ALL" && String(record.record_status || "").trim().toUpperCase() !== statusFilter) {
        return false;
      }
      if (numberFilter && String(record.dc_number || "") !== numberFilter) {
        return false;
      }
      if (!searchFilter) {
        return true;
      }
      const haystack = [
        record.item_code,
        record.title,
        record.current_item_location,
        record.to_location,
        record.dc_number,
        record.delivery_no,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(searchFilter);
    });
    const summaryCards = [
      ["Total Records", summary.total_records ?? 0],
      ["Open", summary.open_records ?? 0],
      ["Linked", summary.linked_records ?? 0],
      ["Empty Links", summary.empty_links ?? 0],
      ["Used Numbers", summary.used_numbers ?? 0],
    ]
      .map(
        ([label, value]) => `
          <article class="analytics-summary-card">
            <p class="analytics-summary-card__label">${escapeHtml(label)}</p>
            <strong class="analytics-summary-card__value">${escapeHtml(value)}</strong>
          </article>
        `
      )
      .join("");
    container.innerHTML = `
      <div class="view-stack">
        <div class="row" style="justify-content: space-between; align-items: center; gap: var(--sp-2); flex-wrap: wrap;">
          <div>
            <h4>${escapeHtml(`Book ${book.book_id}`)}</h4>
            <p class="muted">${escapeHtml(`Range ${book.range_start}-${book.range_end} | Next ${book.next_dc_number} | ${book.is_active ? "Active" : "Inactive"}`)}</p>
          </div>
          <button type="button" id="super-admin-dc-book-close">Close</button>
        </div>
        <div class="analytics-summary-grid">${summaryCards}</div>
        <div class="row" style="gap: var(--sp-2); align-items: end; flex-wrap: wrap;">
          <label style="min-width: 220px; flex: 1 1 220px;">
            Search
            <input id="super-admin-dc-book-record-search" type="text" value="${escapeHtml(state.superAdminDcBookRecordSearch || "")}" placeholder="Code, title, location, number" />
          </label>
          <label style="min-width: 180px;">
            Record Status
            <select id="super-admin-dc-book-record-status-filter">
              <option value="all" ${String(state.superAdminDcBookRecordStatusFilter || "all").toLowerCase() === "all" ? "selected" : ""}>All</option>
              <option value="OPEN" ${String(state.superAdminDcBookRecordStatusFilter || "all").toUpperCase() === "OPEN" ? "selected" : ""}>Open</option>
              <option value="LINKED" ${String(state.superAdminDcBookRecordStatusFilter || "all").toUpperCase() === "LINKED" ? "selected" : ""}>Linked</option>
            </select>
          </label>
          <label style="min-width: 160px;">
            DC No
            <input id="super-admin-dc-book-record-number-filter" type="number" min="1" value="${escapeHtml(state.superAdminDcBookRecordNumberFilter || "")}" placeholder="e.g. 15" />
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DC No</th>
                <th>Item</th>
                <th>Current State</th>
                <th>Current Status</th>
                <th>Record Status</th>
                <th>Linked At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${records.length > 0
                ? records
                    .map(
                      (record) => `
                        <tr>
                          <td>${escapeHtml(record.dc_number || "-")}</td>
                          <td>${escapeHtml(record.item_code || "-")}<div class="muted">${escapeHtml(record.title || "-")}</div></td>
                          <td>${escapeHtml(record.current_item_fill_state || "-")}</td>
                          <td>${escapeHtml(record.current_item_status || "-")}<div class="muted">${escapeHtml(record.current_item_location || "-")}</div></td>
                          <td>${escapeHtml(record.record_status || "-")}</td>
                          <td>${escapeHtml(record.linked_taking_at || "-")}</td>
                          <td>
                            ${record.can_link_empty
                              ? `<button type="button" class="dc-book-link-empty-btn" data-transfer-id="${escapeHtml(record.id)}">Link EMPTY</button>`
                              : `<span class="muted">${escapeHtml(record.record_status === "LINKED" ? "Linked" : "Requires EMPTY item")}</span>`}
                          </td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="7" class="muted">No matching book records</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const closeButton = document.getElementById("super-admin-dc-book-close");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        state.selectedDcBookId = "";
        state.superAdminDcBookDetails = null;
        state.superAdminDcBookRecordSearch = "";
        state.superAdminDcBookRecordStatusFilter = "all";
        state.superAdminDcBookRecordNumberFilter = "";
        renderDcBookDetails();
      });
    }
    const searchInput = document.getElementById("super-admin-dc-book-record-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.superAdminDcBookRecordSearch = String(searchInput.value || "");
        renderDcBookDetails();
      });
    }
    const statusInput = document.getElementById("super-admin-dc-book-record-status-filter");
    if (statusInput) {
      statusInput.addEventListener("change", () => {
        state.superAdminDcBookRecordStatusFilter = String(statusInput.value || "all");
        renderDcBookDetails();
      });
    }
    const numberInput = document.getElementById("super-admin-dc-book-record-number-filter");
    if (numberInput) {
      numberInput.addEventListener("input", () => {
        state.superAdminDcBookRecordNumberFilter = String(numberInput.value || "");
        renderDcBookDetails();
      });
    }
    document.querySelectorAll(".dc-book-link-empty-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const transferId = String(button.getAttribute("data-transfer-id") || "").trim();
        if (!transferId) {
          return;
        }
        state.error = "";
        state.success = "";
        try {
          await api("/api/super-admin/dc-books/link-empty", {
            method: "POST",
            body: JSON.stringify({ transfer_id: transferId })
          });
          state.success = "Success";
          await loadDcBooks();
          if (state.selectedDcBookId) {
            await loadDcBookDetails(state.selectedDcBookId);
          }
          render();
        } catch (error) {
          state.error = error.message;
          render();
        }
      });
    });
  }

  async function loadDcBookDetails(bookId) {
    const normalizedBookId = String(bookId || "").trim();
    if (!normalizedBookId) {
      state.selectedDcBookId = "";
      state.superAdminDcBookDetails = null;
      renderDcBookDetails();
      return;
    }
    const response = await api(`/api/super-admin/dc-books/details?book_id=${encodeURIComponent(normalizedBookId)}`);
    state.selectedDcBookId = normalizedBookId;
    state.superAdminDcBookDetails = response;
    renderDcBookDetails();
  }

  async function loadCustomItemIds() {
    try {
      const response = await api("/api/super-admin/custom-item-ids");
      const mappings = response.data || [];
      const searchFilter = String(state.superAdminCustomIdFilter || "").trim().toLowerCase();
      const filteredMappings = mappings.filter((mapping) => {
        if (!searchFilter) {
          return true;
        }
        const haystack = [
          mapping.item_id,
          mapping.item_code,
          mapping.title,
          mapping.custom_id,
          mapping.updated_at,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return haystack.includes(searchFilter);
      });
      const tbody = document.getElementById("super-admin-custom-ids-tbody");
      if (!tbody) {
        return;
      }
      if (filteredMappings.length === 0) {
        const noDataMessage = mappings.length === 0
          ? (state.labels.superAdmin.noCustomIds || "No custom ID mappings found")
          : (state.labels.superAdmin.noMatchingCustomIds || "No matching custom ID mappings");
        tbody.innerHTML = `<tr><td colspan="6" class="muted">${escapeHtml(noDataMessage)}</td></tr>`;
        return;
      }
      tbody.innerHTML = filteredMappings
        .map(
          (mapping) => `
            <tr>
              <td>${escapeHtml(mapping.item_id || "-")}</td>
              <td>${escapeHtml(mapping.item_code || "-")}</td>
              <td>${escapeHtml(mapping.title || "-")}</td>
              <td>${escapeHtml(mapping.custom_id || "-")}</td>
              <td>${escapeHtml(mapping.updated_at || "-")}</td>
              <td>
                <button type="button" class="custom-id-edit-btn" data-item-id="${escapeHtml(mapping.item_id || "")}" data-custom-id="${escapeHtml(mapping.custom_id || "")}">${escapeHtml(state.labels.common?.edit || "Edit")}</button>
                <button type="button" class="custom-id-delete-btn" data-item-id="${escapeHtml(mapping.item_id || "")}" data-custom-id="${escapeHtml(mapping.custom_id || "")}">${escapeHtml(state.labels.superAdmin.removeCustomId || "Remove")}</button>
              </td>
            </tr>
          `
        )
        .join("");

      document.querySelectorAll(".custom-id-edit-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const itemId = String(btn.getAttribute("data-item-id") || "").trim();
          const customId = String(btn.getAttribute("data-custom-id") || "").trim().toUpperCase();
          const form = document.getElementById("super-admin-custom-id-form");
          if (!form) {
            return;
          }
          const itemInput = form.querySelector('select[name="item_id"]');
          const customInput = form.querySelector('input[name="custom_id"]');
          if (itemInput) {
            itemInput.value = itemId;
          }
          if (customInput) {
            customInput.value = customId;
            customInput.focus();
            customInput.select();
          }
        });
      });

      document.querySelectorAll(".custom-id-delete-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const itemId = String(btn.getAttribute("data-item-id") || "").trim();
          const customId = String(btn.getAttribute("data-custom-id") || "").trim();
          if (!itemId) {
            return;
          }
          if (!confirm(`Remove custom ID mapping ${customId} for item ${itemId}?`)) {
            return;
          }
          state.error = "";
          state.success = "";
          try {
            await api("/api/super-admin/custom-item-ids/delete", {
              method: "DELETE",
              body: JSON.stringify({ item_id: itemId }),
            });
            await hydrateDashboard();
            await loadCustomItemIds();
            state.success = "Success";
            render();
          } catch (error) {
            state.error = error.message;
            render();
          }
        });
      });
    } catch (error) {
      console.error("Failed to load custom item IDs:", error);
    }
  }

  const superAdminCustomIdForm = document.getElementById("super-admin-custom-id-form");
  const superAdminCustomIdFilterInput = document.getElementById("super-admin-custom-id-filter");
  if (superAdminCustomIdFilterInput) {
    let customIdFilterTimer = 0;
    superAdminCustomIdFilterInput.addEventListener("input", () => {
      state.superAdminCustomIdFilter = String(superAdminCustomIdFilterInput.value || "");
      if (customIdFilterTimer) {
        window.clearTimeout(customIdFilterTimer);
      }
      customIdFilterTimer = window.setTimeout(() => {
        customIdFilterTimer = 0;
        loadCustomItemIds();
      }, 180);
    });
  }
  if (superAdminCustomIdForm) {
    superAdminCustomIdForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(superAdminCustomIdForm);
      const itemId = String(formData.get("item_id") || "").trim();
      const customId = String(formData.get("custom_id") || "").trim().toUpperCase();
      if (!itemId) {
        state.error = "Select item";
        render();
        return;
      }
      const validatedCustomId = normalizeCustomIdInput(customId, { required: true });
      if (validatedCustomId.error) {
        state.error = validatedCustomId.error;
        render();
        return;
      }

      try {
        await api("/api/super-admin/custom-item-ids/upsert", {
          method: "POST",
          body: JSON.stringify({ item_id: itemId, custom_id: validatedCustomId.value }),
        });
        handleSuccessfulFormSubmission(superAdminCustomIdForm);
        await hydrateDashboard();
        await loadCustomItemIds();
      } catch (error) {
        if (/custom_id already exists/i.test(String(error.message || ""))) {
          const shouldReassign = confirm("This Custom ID is already mapped to another item. Remove old mapping and map it to this item?");
          if (shouldReassign) {
            try {
              await api("/api/super-admin/custom-item-ids/upsert", {
                method: "POST",
                body: JSON.stringify({
                  item_id: itemId,
                  custom_id: validatedCustomId.value,
                  reassign_from_existing: true,
                }),
              });
              handleSuccessfulFormSubmission(superAdminCustomIdForm);
              await hydrateDashboard();
              await loadCustomItemIds();
              return;
            } catch (reassignError) {
              state.error = reassignError.message;
              render();
              return;
            }
          }
        }
        state.error = error.message;
        render();
      }
    });

    loadCustomItemIds();
  }

  const superAdminDcBookForm = document.getElementById("super-admin-dc-book-form");
  const superAdminDcBookFilterInput = document.getElementById("super-admin-dc-book-filter");
  const superAdminDcBookActiveFilterInput = document.getElementById("super-admin-dc-book-active-filter");
  if (superAdminDcBookFilterInput) {
    superAdminDcBookFilterInput.addEventListener("input", () => {
      state.superAdminDcBookFilter = String(superAdminDcBookFilterInput.value || "");
      loadDcBooks();
    });
  }
  if (superAdminDcBookActiveFilterInput) {
    superAdminDcBookActiveFilterInput.addEventListener("change", () => {
      state.superAdminDcBookActiveFilter = String(superAdminDcBookActiveFilterInput.value || "all");
      loadDcBooks();
    });
  }
  if (superAdminDcBookForm) {
    superAdminDcBookForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(superAdminDcBookForm);
      const bookId = String(formData.get("book_id") || "").trim();
      const rangeStart = String(formData.get("range_start") || "0").trim();
      const rangeEnd = String(formData.get("range_end") || "100").trim();

      if (!bookId) {
        state.error = "Book ID is required";
        render();
        return;
      }

      try {
        await api("/api/super-admin/dc-books/create", {
          method: "POST",
          body: JSON.stringify({
            book_id: bookId,
            range_start: parseInt(rangeStart, 10),
            range_end: parseInt(rangeEnd, 10)
          })
        });
        handleSuccessfulFormSubmission(superAdminDcBookForm);
        const startInput = superAdminDcBookForm.querySelector('input[name="range_start"]');
        const endInput = superAdminDcBookForm.querySelector('input[name="range_end"]');
        if (startInput) startInput.value = "0";
        if (endInput) endInput.value = "100";
        await loadDcBooks();
        renderDcBookDetails();
      } catch (error) {
        state.error = error.message;
        render();
      }
    });

    loadDcBooks();
    renderDcBookDetails();
  }

  const notificationRequirementForm = document.getElementById("notification-requirement-form");
  if (notificationRequirementForm) {
    notificationRequirementForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      const formData = new FormData(notificationRequirementForm);
      const toUserId = String(formData.get("to_user_id") || "").trim();
      const message = String(formData.get("message") || "").trim();
      if (!toUserId) {
        state.error = state.labels.notifications.noRecipients || "No recipients available";
        render();
        return;
      }
      if (message.length < 3 || message.length > 500) {
        state.error = "Requirement message must be between 3 and 500 characters";
        render();
        return;
      }
      try {
        await api("/api/notifications/requirement", {
          method: "POST",
          body: JSON.stringify({
            to_user_id: toUserId,
            item_id: String(formData.get("item_id") || "").trim(),
            message
          })
        });
        await hydrateNotifications();
        handleSuccessfulFormSubmission(notificationRequirementForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const notificationsMarkAllBtn = document.getElementById("notifications-mark-all");
  bindClickAction(notificationsMarkAllBtn, async () => {
    await api("/api/notifications/mark-read", {
      method: "POST",
      body: JSON.stringify({ mark_all: true })
    });
    await hydrateNotifications();
    render();
  });

  const notificationsSearchFilterInput = document.getElementById("notifications-search-filter");
  if (notificationsSearchFilterInput) {
    notificationsSearchFilterInput.addEventListener("input", (event) => {
      state.notificationSearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const notificationsTypeFilterInput = document.getElementById("notifications-type-filter");
  if (notificationsTypeFilterInput) {
    notificationsTypeFilterInput.addEventListener("change", (event) => {
      state.notificationTypeFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const notificationsDeliveryFilterInput = document.getElementById("notifications-delivery-no-filter");
  if (notificationsDeliveryFilterInput) {
    notificationsDeliveryFilterInput.addEventListener("change", (event) => {
      state.notificationDeliveryNoFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  document.querySelectorAll("[data-mark-read]").forEach((button) => {
    bindClickAction(button, async () => {
      const notificationId = String(button.getAttribute("data-mark-read") || "").trim();
      if (!notificationId) {
        return;
      }
      await api("/api/notifications/mark-read", {
        method: "POST",
        body: JSON.stringify({ notification_id: notificationId })
      });
      await hydrateNotifications();
      render();
    });
  });

  const ordersUpsertForm = document.getElementById("orders-upsert-form");
  if (ordersUpsertForm) {
    ordersUpsertForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      if (!canCreateOrders()) {
        state.error = "Forbidden";
        render();
        return;
      }
      const formData = new FormData(ordersUpsertForm);
      try {
        await api("/api/orders/create-or-update", {
          method: "POST",
          body: JSON.stringify({
            order_id: String(formData.get("order_id") || "").trim(),
            item_id: String(formData.get("item_id") || "").trim(),
            customer_name: String(formData.get("customer_name") || "").trim(),
            customer_contact: String(formData.get("customer_contact") || "").trim(),
            quantity: Number(formData.get("quantity") || 1),
            notes: String(formData.get("notes") || "").trim()
          })
        });
        await hydrateOrders();
        await hydrateNotifications();
        handleSuccessfulFormSubmission(ordersUpsertForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const ordersApproveForm = document.getElementById("orders-approve-form");
  if (ordersApproveForm) {
    ordersApproveForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      if (!canApproveOrders()) {
        state.error = "Forbidden";
        render();
        return;
      }
      const submitter = event.submitter;
      const action = submitter ? String(submitter.getAttribute("data-approve-action") || "approve") : "approve";
      const formData = new FormData(ordersApproveForm);
      const orderId = String(formData.get("order_id") || "").trim();
      const deliveryUserId = String(formData.get("delivery_user_id") || "").trim();
      if (!orderId) {
        state.error = "Select an order to process";
        render();
        return;
      }
      if (action !== "reject" && !deliveryUserId) {
        state.error = "Select a delivery user for approval";
        render();
        return;
      }
      try {
        await api("/api/orders/approve", {
          method: "POST",
          body: JSON.stringify({
            order_id: orderId,
            delivery_user_id: deliveryUserId,
            admin_note: String(formData.get("admin_note") || "").trim(),
            approved: action !== "reject"
          })
        });
        await hydrateOrders();
        await hydrateNotifications();
        handleSuccessfulFormSubmission(ordersApproveForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const ordersDeliveryForm = document.getElementById("orders-delivery-form");
  if (ordersDeliveryForm) {
    ordersDeliveryForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.error = "";
      state.success = "";
      if (!canDeliverOrders()) {
        state.error = "Forbidden";
        render();
        return;
      }
      const formData = new FormData(ordersDeliveryForm);
      const orderId = String(formData.get("order_id") || "").trim();
      if (!orderId) {
        state.error = "Select an order to mark delivered";
        render();
        return;
      }
      try {
        await api("/api/orders/mark-delivered", {
          method: "POST",
          body: JSON.stringify({
            order_id: orderId,
            delivery_note: String(formData.get("delivery_note") || "").trim()
          })
        });
        await hydrateOrders();
        await hydrateNotifications();
        handleSuccessfulFormSubmission(ordersDeliveryForm);
      } catch (error) {
        state.error = error.message;
        render();
      }
    });
  }

  const ordersSearchFilterInput = document.getElementById("orders-search-filter");
  if (ordersSearchFilterInput) {
    ordersSearchFilterInput.addEventListener("input", (event) => {
      state.orderSearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const ordersStatusFilterInput = document.getElementById("orders-status-filter");
  if (ordersStatusFilterInput) {
    ordersStatusFilterInput.addEventListener("change", (event) => {
      state.orderStatusFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const ordersDeliveryFilterInput = document.getElementById("orders-delivery-no-filter");
  if (ordersDeliveryFilterInput) {
    ordersDeliveryFilterInput.addEventListener("change", (event) => {
      state.orderDeliveryNoFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const logsSearchFilterInput = document.getElementById("logs-search-filter");
  if (logsSearchFilterInput) {
    logsSearchFilterInput.addEventListener("input", (event) => {
      state.logSearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const logsActionFilterInput = document.getElementById("logs-action-filter");
  if (logsActionFilterInput) {
    logsActionFilterInput.addEventListener("change", (event) => {
      state.logActionFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const logsDeliveryFilterInput = document.getElementById("logs-delivery-no-filter");
  if (logsDeliveryFilterInput) {
    logsDeliveryFilterInput.addEventListener("change", (event) => {
      state.logDeliveryNoFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const itemsSearchFilterInput = document.getElementById("items-search-filter");
  if (itemsSearchFilterInput) {
    itemsSearchFilterInput.addEventListener("input", (event) => {
      state.itemSearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const itemsStatusFilterInput = document.getElementById("items-status-filter");
  if (itemsStatusFilterInput) {
    itemsStatusFilterInput.addEventListener("change", (event) => {
      state.itemStatusFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const itemsCategoryFilterInput = document.getElementById("items-category-filter");
  if (itemsCategoryFilterInput) {
    itemsCategoryFilterInput.addEventListener("change", (event) => {
      state.itemCategoryFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const itemsUserFilterInput = document.getElementById("items-user-filter");
  if (itemsUserFilterInput) {
    itemsUserFilterInput.addEventListener("input", (event) => {
      state.itemUserFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const usersSearchFilterInput = document.getElementById("users-search-filter");
  if (usersSearchFilterInput) {
    usersSearchFilterInput.addEventListener("input", (event) => {
      state.userSearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const usersRoleFilterInput = document.getElementById("users-role-filter");
  if (usersRoleFilterInput) {
    usersRoleFilterInput.addEventListener("change", (event) => {
      state.userRoleFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const usersActiveFilterInput = document.getElementById("users-active-filter");
  if (usersActiveFilterInput) {
    usersActiveFilterInput.addEventListener("change", (event) => {
      state.userActiveFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const sessionsSearchFilterInput = document.getElementById("sessions-search-filter");
  if (sessionsSearchFilterInput) {
    sessionsSearchFilterInput.addEventListener("input", (event) => {
      state.sessionSearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const sessionsActiveFilterInput = document.getElementById("sessions-active-filter");
  if (sessionsActiveFilterInput) {
    sessionsActiveFilterInput.addEventListener("change", (event) => {
      state.sessionActiveFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  const activitySearchFilterInput = document.getElementById("activity-search-filter");
  if (activitySearchFilterInput) {
    activitySearchFilterInput.addEventListener("input", (event) => {
      state.activitySearchFilter = String(event.target.value || "");
      scheduleRenderPreservingScroll();
    });
  }

  const activityActionFilterInput = document.getElementById("activity-action-filter");
  if (activityActionFilterInput) {
    activityActionFilterInput.addEventListener("change", (event) => {
      state.activityActionFilter = String(event.target.value || "").trim();
      renderPreservingScroll();
    });
  }

  document.querySelectorAll("[data-transfer-more]").forEach((button) => {
    button.addEventListener("click", async () => {
      const processId = String(button.getAttribute("data-transfer-more") || "").trim();
      if (!processId) {
        return;
      }

      if (state.transferHistoryExpandedProcessId === processId) {
        state.transferHistoryExpandedProcessId = "";
        renderPreservingScroll();
        return;
      }

      state.transferHistoryExpandedProcessId = processId;
      if (state.transitionProcessDetails[processId]) {
        renderPreservingScroll();
        return;
      }

      state.transferHistoryLoadingProcessId = processId;
      renderPreservingScroll();
      try {
        const result = await api(`/api/transition/process-details?process_id=${encodeURIComponent(processId)}`);
        state.transitionProcessDetails[processId] = Array.isArray(result.data) ? result.data : [];
      } catch (error) {
        state.error = error.message;
      } finally {
        if (state.transferHistoryLoadingProcessId === processId) {
          state.transferHistoryLoadingProcessId = "";
        }
        renderPreservingScroll();
      }
    });
  });

  const verifyButton = document.getElementById("verify-logs");
  if (verifyButton) {
    verifyButton.addEventListener("click", async () => {
      const resultEl = document.getElementById("verify-result");
      resultEl.textContent = state.labels.common.loading;
      try {
        const verification = await api("/api/logs/verify", { method: "POST", body: JSON.stringify({}) });
        resultEl.textContent = `${state.labels.logs.verified}: ${verification.verified} | ${state.labels.logs.mismatches}: ${verification.mismatches}`;
      } catch (error) {
        resultEl.textContent = error.message;
      }
    });
  }
}

function dashboardView() {
  const labels = state.labels;
  const content = resolveViewContent();
  const contentClass = state.view === "items-list" ? "app-content app-content--items-scroll-lock" : "app-content";
  app.innerHTML = `
    <header class="app-header">
      <div class="app-header__brand">
        <h2>${escapeHtml(labels.app.title)}</h2>
        <p class="muted">${escapeHtml(`${state.user.email} (${state.user.role})`)}</p>
      </div>
      ${navView()}
    </header>
    <div class="${contentClass}">
      ${content}
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    </div>
    ${renderSuccessModal()}
  `;
    restoreCurrentFormDrafts();
  attachNavigation();
  attachForms();
}

async function hydrateProfile() {
  const me = await api("/api/me");
  state.profile = me.user;
  state.csrfToken = String(me.csrf_token || state.csrfToken || "");
}

async function hydrateUsers() {
  const canSeeUsers = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  if (!canSeeUsers) {
    state.users = [];
    return;
  }
  const usersRes = await api("/api/users");
  state.users = usersRes.data || [];
  if (!state.loginControlsUserId && state.users.length > 0) {
    state.loginControlsUserId = state.users[0].id;
  }
}

async function hydrateCompanies() {
  if (!canManageCompanySetup()) {
    state.companies = [];
    state.companyLocations = [];
    state.companySetupSelectedCompanyId = "";
    state.companySetupSelectedLocationId = "";
      state.customerLocations = [];
      state.fillerLocations = [];
      state.customerLocationSelectedId = "";
      state.fillerLocationSelectedId = "";
    return;
  }
  try {
    const companiesRes = await api("/api/companies");
    state.companies = companiesRes.data || [];
    const locationsRes = await api("/api/company-locations");
    state.companyLocations = locationsRes.data || [];

    // Optional endpoints: if unavailable, keep core company setup enabled.
    try {
      const custLocRes = await api("/api/customer-locations");
      state.customerLocations = custLocRes.data || [];
    } catch (error) {
      if (error?.status === 404) {
        state.customerLocations = [];
      } else {
        throw error;
      }
    }

    try {
      const fillerLocRes = await api("/api/filler-locations");
      state.fillerLocations = fillerLocRes.data || [];
    } catch (error) {
      if (error?.status === 404) {
        state.fillerLocations = [];
      } else {
        throw error;
      }
    }

    state.apiAvailability.companySetup = true;
  } catch (error) {
    if (error?.status === 404) {
      state.apiAvailability.companySetup = false;
      state.companies = [];
      state.companyLocations = [];
      state.companySetupSelectedCompanyId = "";
      state.companySetupSelectedLocationId = "";
      state.customerLocations = [];
      state.fillerLocations = [];
      state.customerLocationSelectedId = "";
      state.fillerLocationSelectedId = "";
      return;
    }
    throw error;
  }
  const selectedCompanyExists = state.companies.some((entry) => String(entry.id || "") === String(state.companySetupSelectedCompanyId || ""));
  if (!selectedCompanyExists) {
    state.companySetupSelectedCompanyId = "";
  }
  const selectedLocationExists = state.companyLocations.some((entry) => String(entry.id || "") === String(state.companySetupSelectedLocationId || ""));
  if (!selectedLocationExists) {
    state.companySetupSelectedLocationId = "";
  }
}

async function hydrateItemCategories() {
  const canUseManagedCategories = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  if (!canUseManagedCategories) {
    state.itemCategories = [];
    return;
  }
  const categoriesRes = await api("/api/item-categories");
  state.itemCategories = categoriesRes.data || [];
}

async function hydrateVolumeUnits() {
  const canUseManagedUnits = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  if (!canUseManagedUnits) {
    state.volumeUnits = [...DEFAULT_CYLINDER_VOLUME_UNITS];
    return;
  }
  const result = await api("/api/volume-units");
  const rows = Array.isArray(result.data) ? result.data : [];
  const values = rows
    .map((row) => normalizeVolumeUnitClient(row?.unit_name))
    .filter((value, index, arr) => value && arr.indexOf(value) === index);
  state.volumeUnits = values.length > 0 ? values : [...DEFAULT_CYLINDER_VOLUME_UNITS];
}

async function hydrateLoginControls() {
  if (!canAccessLoginControls()) {
    state.loginControls = [];
    return;
  }
  if (!state.loginControlsUserId) {
    state.loginControls = [];
    return;
  }
  const controlsRes = await api(`/api/login-controls?user_id=${encodeURIComponent(state.loginControlsUserId)}`);
  state.loginControls = controlsRes.data || [];
}

async function hydrateSuperAdminStats() {
  if (!canAccessSuperAdminPage()) {
    state.superAdminStats = null;
    return;
  }
  const result = await api("/api/super-admin/stats");
  state.superAdminStats = result.data || null;
}

async function hydrateBackups() {
  if (!canAccessBackups()) {
    state.backups = [];
    return;
  }
  const result = await api("/api/backups");
  state.backups = Array.isArray(result.data) ? result.data : [];
}

async function hydrateNotifications() {
  const result = await api("/api/notifications");
  state.notifications = result.data || [];
}

async function hydrateOrders() {
  if (!canManageOrders()) {
    state.orders = [];
    return;
  }
  const result = await api("/api/orders");
  state.orders = result.data || [];
}

async function hydrateAnalytics() {
  if (!canAccessAnalytics()) {
    state.analytics = null;
    return;
  }
  if (!state.apiAvailability.analytics) {
    state.analytics = buildLocalAnalyticsResult();
    return;
  }
  const apiFilterKeys = ["analytics_type", "group_by", "start_date", "end_date", "user_id", "item_id", "delivery_user_id"];
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state.analyticsFilters || {})) {
    if (!apiFilterKeys.includes(key)) {
      continue;
    }
    if (value) {
      params.set(key, String(value));
    }
  }
  try {
    const result = await api(`/api/analytics?${params.toString()}`);
    state.analytics = applyAnalyticsDisplayFilters(result);
  } catch (error) {
    if (error.status === 404) {
      state.apiAvailability.analytics = false;
      state.analytics = buildLocalAnalyticsResult();
      state.error = state.labels.analytics.endpointMissing || "Analytics endpoint is not available in current backend. Showing local fallback analytics.";
      return;
    }
    throw error;
  }
}

function resetTransitionFlow() {
  state.transitionFlow = {
    step: 1,
    action: "",
    sourceType: "",
    sourceUserId: "",
    sourceLocationId: "",
    dispatchTargetType: "",
    dispatchUserId: "",
    dispatchUserQuery: "",
    dispatchCustomerName: "",
    dcBookId: "",
    linkDcRef: "",
    selectedItemIds: [],
    selectedItemStates: {},
    processId: "",
    pendingProcessId: "",
    pendingAction: ""
  };
  state.transitionInfoOpen = false;
  state.transitionItems = [];
  state.transitionDcBooks = [];
  state.transitionDcLinks = [];
}

async function hydrateTransitionUsers() {
  if (!canAccessTransition()) {
    state.transitionUsers = [];
    return;
  }
  const usersRes = await api("/api/transition/users");
  state.transitionUsers = usersRes.data || [];
}

async function hydrateTransitionCustomerLocations() {
  if (!canAccessTransition()) {
    return;
  }
  try {
    const locationsRes = await api("/api/customer-locations");
    state.customerLocations = locationsRes.data || [];
  } catch (error) {
    if (error?.status === 403 || error?.status === 404) {
      state.customerLocations = [];
      return;
    }
    throw error;
  }
}

async function hydrateTransitionItems() {
  if (!canAccessTransition()) {
    state.transitionItems = [];
    return;
  }
  const sourceType = state.transitionFlow.sourceType;
  const sourceUserId = state.transitionFlow.sourceUserId;
  const sourceLocationId = state.transitionFlow.sourceLocationId;
  const processId = String(state.transitionFlow.processId || "").trim();
  let path = `/api/transition/items?source_type=${encodeURIComponent(sourceType)}`;
  if ((sourceType === "EMPLOYEE" || sourceType === "FILLER" || sourceType === "CUSTOMER") && sourceUserId) {
    path += `&source_user_id=${encodeURIComponent(sourceUserId)}`;
  }
  if ((sourceType === "CUSTOMER" || sourceType === "SELF") && sourceLocationId) {
    path += `&source_location_id=${encodeURIComponent(sourceLocationId)}`;
  }
  if (sourceType === "TRANSIT" && processId) {
    path += `&process_id=${encodeURIComponent(processId)}`;
  }
  const itemsRes = await api(path);
  state.transitionItems = itemsRes.data || [];
}

async function hydrateTransitionDcBooks() {
  if (!canAccessTransition()) {
    state.transitionDcBooks = [];
    return;
  }
  const result = await api("/api/dc-books/available");
  state.transitionDcBooks = result.data || [];
}

async function hydrateTransitionDcLinks() {
  if (!canAccessTransition()) {
    state.transitionDcLinks = [];
    return;
  }
  const result = await api("/api/transition/dc-links");
  state.transitionDcLinks = result.data || [];
}

async function hydrateTransitionProcesses() {
  if (!canAccessTransition()) {
    state.transitionProcesses = [];
    state.transitionProcessDetails = {};
    state.transferHistoryExpandedProcessId = "";
    state.transferHistoryLoadingProcessId = "";
    return;
  }
  const result = await api("/api/transition/processes");
  state.transitionProcesses = result.data || [];
}

async function hydrateItemStatusPolicy() {
  const result = await api("/api/items/status-transitions");
  const sequence = Array.isArray(result.sequence) ? result.sequence.map((value) => String(value || "").toUpperCase()) : [];
  const transitions = {};
  if (isPlainObject(result.transitions)) {
    for (const [status, nextStatuses] of Object.entries(result.transitions)) {
      const normalizedStatus = String(status || "").toUpperCase();
      transitions[normalizedStatus] = Array.isArray(nextStatuses)
        ? nextStatuses.map((value) => String(value || "").toUpperCase())
        : [];
    }
  }
  if (sequence.length === 0 || Object.keys(transitions).length === 0) {
    throw new Error("Invalid item status policy response");
  }
  state.itemStatusPolicy = { sequence, transitions };
}

async function fetchNextItemCode(category = "", prefix = "", itemType = "") {
  const normalizedCategory = String(category || "").trim();
  const normalizedPrefix = String(prefix || "").trim();
  const normalizedItemType = String(itemType || "").trim().toUpperCase();
  let query = normalizedCategory ? `?category=${encodeURIComponent(normalizedCategory)}` : "";
  if (normalizedPrefix) {
    query += (query ? "&" : "?") + `prefix=${encodeURIComponent(normalizedPrefix)}`;
  }
  if (normalizedItemType) {
    query += (query ? "&" : "?") + `item_type=${encodeURIComponent(normalizedItemType)}`;
  }
  const result = await api(`/api/items/next-code${query}`);
  return String(result.item_code || "");
}

async function hydrateNextItemCode() {
  const category = arguments.length > 0 ? arguments[0] : "";
  state.lastGeneratedItemCode = await fetchNextItemCode(category);
}

async function hydrateDashboard() {
  ensureAllowedView();
  const canSeeLogs = state.user && ["SUPER_ADMIN", "ADMIN"].includes(state.user.role);
  const readOptionalList = async (path) => {
    try {
      return await api(path);
    } catch (error) {
      if (error && error.status === 404) {
        return { data: [] };
      }
      throw error;
    }
  };
  await hydrateItemStatusPolicy();
  const [itemsRes, sessionsRes] = await Promise.all([api("/api/items"), api("/api/sessions/me")]);
  state.items = itemsRes.data || [];
  state.sessions = sessionsRes.data || [];

  const logsPromise = canSeeLogs ? readOptionalList("/api/logs") : Promise.resolve({ data: [] });
  const activityPromise = canSeeLogs ? readOptionalList("/api/activity-logs") : Promise.resolve({ data: [] });
  const taskPromises = [hydrateOrders(), hydrateNotifications(), hydrateNextItemCode(), hydrateUsers(), hydrateProfile(), hydrateItemCategories(), hydrateVolumeUnits(), hydrateCompanies()];
  if (canAccessBackups()) {
    taskPromises.push(hydrateBackups());
  } else {
    state.backups = [];
  }
  if (canAccessSuperAdminPage()) {
    taskPromises.push(hydrateSuperAdminStats());
  } else {
    state.superAdminStats = null;
  }

  const results = await Promise.all([...taskPromises, logsPromise, activityPromise]);
  const logsRes = results[results.length - 2] || { data: [] };
  const activityRes = results[results.length - 1] || { data: [] };
  state.logs = logsRes.data || [];
  state.activityLogs = activityRes.data || [];
}

function render() {
    if (state.error) {
      captureCurrentFormDrafts();
    } else {
      state.formDrafts = {};
    }

  if (!state.labels) {
    app.innerHTML = "<section class='panel'><p>Loading...</p></section>";
    return;
  }
  if (!state.user) {
    loginView();
    return;
  }
  ensureAllowedView();
  dashboardView();
}

async function bootstrap() {
  state.labels = await fetch("/labels.en.json").then((response) => response.json());
  try {
    const me = await api("/api/me", { suppressUnauthorized: true });
    state.user = me.user;
    state.csrfToken = String(me.csrf_token || "");
    state.profile = me.user;
    await hydrateDashboard();
  } catch {
    state.user = null;
    state.csrfToken = "";
    state.profile = null;
    state.error = "";
  }
  render();
}

bootstrap();

