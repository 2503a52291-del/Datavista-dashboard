/* =========================================================
   AI TOOLS USAGE ANALYTICS DASHBOARD
   Data source: ai_tools_cleaned.csv
   ========================================================= */

const CONFIG = {
    csvFile: "ai_tools_cleaned.csv",

    columns: {
        timestamp: "Timestamp",
        year: "year",
        tool: "ai tool",
        purpose: "mainly use AI tools for",
        frequency: "frequency",
        time: "time spent",
        helpfulness: "helpful of ai tools",
        productivity: "AI tools improve your productivity",
        improvement: "improved because of ai tools",
        recommend: "recommend to others",
        experience: "overall experience"
    },

    colors: [
        "#8b7cff",
        "#57a6ff",
        "#44d7a8",
        "#ffb86b",
        "#f18bce",
        "#a4a9ff",
        "#54d4df",
        "#ff7b92",
        "#c3d87a"
    ]
};

let rawData = [];
let filteredData = [];
let charts = {};
let activeChartFilters = {};


/* =========================================================
   CHART DEFINITIONS
   ========================================================= */

const chartDefinitions = [
    {
        id: "chart-tool-popularity",
        type: "bar",
        field: "tool",
        horizontal: true,
        title: "AI Tool Popularity"
    },
    {
        id: "chart-frequency",
        type: "bar",
        field: "frequency",
        title: "AI Usage Frequency"
    },
    {
        id: "chart-experience",
        type: "doughnut",
        field: "experience",
        title: "Student Experience"
    },
    {
        id: "chart-year-comparison",
        type: "bar",
        field: "tool",
        groupBy: "year",
        title: "AI Tool Usage by Study Year"
    },
    {
        id: "chart-usage-doughnut",
        type: "doughnut",
        field: "tool",
        title: "AI Tool Distribution"
    },
    {
        id: "chart-usage-frequency",
        type: "bar",
        field: "frequency",
        title: "Usage Frequency"
    },
    {
        id: "chart-time-spent",
        type: "bar",
        field: "time",
        horizontal: true,
        title: "Time Spent Using AI Tools"
    },
    {
        id: "chart-experience-detail",
        type: "doughnut",
        field: "experience",
        title: "Overall Experience"
    },
    {
        id: "chart-learning-impact",
        type: "bar",
        field: "productivity",
        horizontal: true,
        title: "Productivity Improvement"
    },
    {
        id: "chart-helpfulness",
        type: "bar",
        field: "helpfulness",
        horizontal: true,
        title: "Perceived Helpfulness of AI"
    },
    {
        id: "chart-comparison-years",
        type: "bar",
        field: "tool",
        groupBy: "year",
        title: "AI Tool Preference Across Study Years"
    },
    {
        id: "chart-comparison-frequency",
        type: "bar",
        field: "frequency",
        groupBy: "tool",
        title: "Usage Frequency by AI Tool"
    }
];


/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function normalizeText(value) {
    return String(value ?? "").trim();
}

function normalizeKey(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function normalizeToolName(value) {
    const original = normalizeText(value);

    if (!original) return "";

    const compact = original
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

    const knownTools = {
        chatgpt: "ChatGPT",
        gemini: "Google Gemini",
        googlegemini: "Google Gemini",
        copilot: "Microsoft Copilot",
        microsoftcopilot: "Microsoft Copilot",
        githubcopilot: "GitHub Copilot",
        claude: "Claude"
    };

    return knownTools[compact] || original;
}

function isMissing(value) {
    const text = normalizeText(value).toLowerCase();

    return (
        !text ||
        text === "nan" ||
        text === "null" ||
        text === "undefined"
    );
}

function getColumnKey(field) {
    return CONFIG.columns[field] || field;
}

function getValue(row, field) {
    const wanted = normalizeKey(getColumnKey(field));

    const key = Object.keys(row).find(
        column => normalizeKey(column) === wanted
    );

    const value = key ? normalizeText(row[key]) : "";

    if (field === "tool") {
        return normalizeToolName(value);
    }

    return value;
}

function uniqueValues(data, field) {
    return [...new Set(
        data
            .map(row => getValue(row, field))
            .filter(value => !isMissing(value))
    )].sort((a, b) => a.localeCompare(b));
}

function countBy(data, field) {
    const counts = new Map();

    data.forEach(row => {
        const value = getValue(row, field);

        if (!isMissing(value)) {
            counts.set(value, (counts.get(value) || 0) + 1);
        }
    });

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1]);
}

function percentage(part, total) {
    return total ? (part / total) * 100 : 0;
}

function formatPercentage(value) {
    return `${value.toFixed(1)}%`;
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function getChartColor(index) {
    return CONFIG.colors[index % CONFIG.colors.length];
}

function isChartAvailable(canvasId) {
    return Boolean(document.getElementById(canvasId));
}


/* =========================================================
   CSV LOADING
   ========================================================= */

async function loadCSV() {
    setText("data-status", "Loading student data...");

    try {
        const response = await fetch(CONFIG.csvFile, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load ${CONFIG.csvFile}. HTTP ${response.status}`
            );
        }

        const csvText = await response.text();

        const result = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: "greedy",
            transformHeader: header => header.trim()
        });

        if (result.errors.length) {
            console.warn("CSV parsing warnings:", result.errors);
        }

        rawData = result.data.filter(row =>
            Object.values(row).some(value => !isMissing(value))
        );

        if (!rawData.length) {
            throw new Error("The CSV contains no usable responses.");
        }

        console.log("CSV headers:", Object.keys(rawData[0]));
        console.log("Responses loaded:", rawData.length);

        validateColumns();

        filteredData = [...rawData];

        populateFilters();
        setupNavigation();
        setupFilterEvents();
        setupResetButtons();

        createAllCharts();
        applyFilters();

        setText(
            "data-status",
            `${rawData.length.toLocaleString()} responses loaded`
        );

    } catch (error) {
        console.error("Dashboard loading error:", error);

        setText("data-status", "Data loading failed");

        showDataError(error.message);
    }
}


/* =========================================================
   DATA VALIDATION
   ========================================================= */

function validateColumns() {
    if (!rawData.length) {
        throw new Error("No records were found in the CSV.");
    }

    const headers = Object.keys(rawData[0]);
    const normalizedHeaders = headers.map(normalizeKey);

    const required = ["tool", "year", "frequency"];

    const missing = required.filter(field =>
        !normalizedHeaders.includes(
            normalizeKey(getColumnKey(field))
        )
    );

    if (missing.length) {
        console.warn(
            "Required columns not found:",
            missing.map(field => getColumnKey(field))
        );
    }

    if (!uniqueValues(rawData, "tool").length) {
        throw new Error(
            'The "ai tool" column is missing or contains no values.'
        );
    }
}


/* =========================================================
   FILTER CONTROLS
   ========================================================= */

function populateSelect(selectId, field, defaultLabel) {
    const select = document.getElementById(selectId);

    if (!select) return;

    select.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "all";
    defaultOption.textContent = defaultLabel;

    select.appendChild(defaultOption);

    uniqueValues(rawData, field).forEach(value => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });
}

function populateFilters() {
    populateSelect("filter-tool", "tool", "All AI Tools");
    populateSelect("filter-year", "year", "All Study Years");
    populateSelect("filter-frequency", "frequency", "All Frequencies");
    populateSelect("filter-experience", "experience", "All Experiences");
}

function setupFilterEvents() {
    const mappings = {
        "filter-tool": "tool",
        "filter-year": "year",
        "filter-frequency": "frequency",
        "filter-experience": "experience"
    };

    Object.entries(mappings).forEach(([id, field]) => {
        const select = document.getElementById(id);

        if (!select) return;

        select.addEventListener("change", () => {
            if (select.value === "all") {
                delete activeChartFilters[field];
            } else {
                activeChartFilters[field] = select.value;
            }

            applyFilters();
        });
    });
}

function setupResetButtons() {
    document.querySelectorAll(".reset-button").forEach(button => {
        button.addEventListener("click", resetFilters);
    });
}

function resetFilters() {
    activeChartFilters = {};

    [
        "filter-tool",
        "filter-year",
        "filter-frequency",
        "filter-experience"
    ].forEach(id => {
        const select = document.getElementById(id);

        if (select) {
            select.value = "all";
        }
    });

    applyFilters();
}


/* =========================================================
   CROSS-FILTERING
   ========================================================= */

function applyFilters() {
    filteredData = rawData.filter(row =>
        Object.entries(activeChartFilters).every(
            ([field, selectedValue]) =>
                getValue(row, field) === selectedValue
        )
    );

    updateActiveFilterText();
    updateKPI();

    chartDefinitions.forEach(updateChart);
}

function updateActiveFilterText() {
    const active = Object.entries(activeChartFilters);

    if (!active.length) {
        setText("active-filters", "Showing all responses");
        return;
    }

    const labels = {
        tool: "AI Tool",
        year: "Study Year",
        frequency: "Usage Frequency",
        experience: "Experience"
    };

    const description = active
        .map(([field, value]) =>
            `${labels[field] || field}: ${value}`
        )
        .join(" • ");

    setText("active-filters", `Active filters: ${description}`);
}


/* =========================================================
   KPI CARDS
   ========================================================= */

function updateKPI() {
    const total = filteredData.length;

    setText("kpi-total", total.toLocaleString());

    const toolCounts = countBy(filteredData, "tool");
    const popularTool = toolCounts[0];

    if (popularTool) {
        setText("kpi-popular-tool", popularTool[0]);

        setText(
            "kpi-popular-detail",
            `${popularTool[1].toLocaleString()} responses`
        );

        setText(
            "kpi-share",
            formatPercentage(percentage(popularTool[1], total))
        );
    } else {
        setText("kpi-popular-tool", "—");
        setText("kpi-popular-detail", "No matching responses");
        setText("kpi-share", "0.0%");
    }

    /*
      The positive-experience KPI remains uncalculated until
      the survey response categories have been verified.
    */
    setText("kpi-positive", "—");
}


/* =========================================================
   CHART CREATION
   ========================================================= */

function createAllCharts() {
    if (typeof Chart === "undefined") {
        throw new Error("Chart.js failed to load.");
    }

    Chart.defaults.color = "#91a0bb";
    Chart.defaults.font.family = "Inter, sans-serif";
    Chart.defaults.font.size = 11;

    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 17;

    Chart.defaults.plugins.tooltip.backgroundColor = "#0a1020";
    Chart.defaults.plugins.tooltip.borderColor = "#354563";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 12;
    Chart.defaults.plugins.tooltip.cornerRadius = 9;

    chartDefinitions.forEach(definition => {
        if (!isChartAvailable(definition.id)) {
            console.warn(
                `Canvas not found in HTML: ${definition.id}`
            );
            return;
        }

        const canvas = document.getElementById(definition.id);

        if (charts[definition.id]) {
            charts[definition.id].destroy();
        }

        const horizontal = definition.horizontal === true;

        charts[definition.id] = new Chart(canvas.getContext("2d"), {
            type: definition.type,

            data: {
                labels: [],
                datasets: []
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                animation: {
                    duration: 350
                },

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                indexAxis: horizontal ? "y" : "x",

                plugins: {
                    legend: {
                        display:
                            definition.type === "doughnut" ||
                            Boolean(definition.groupBy),
                        position: "bottom"
                    },

                    tooltip: {
                        callbacks: {
                            label(context) {
                                const value =
                                    context.parsed?.y ??
                                    context.parsed?.x ??
                                    context.raw;

                                return ` ${context.dataset.label || "Responses"}: ${value}`;
                            }
                        }
                    }
                },

                scales: definition.type === "doughnut"
                    ? {}
                    : {
                        x: {
                            beginAtZero: true,
                            grid: {
                                color: "rgba(145,160,187,0.09)"
                            },
                            border: {
                                display: false
                            },
                            ticks: {
                                precision: 0
                            }
                        },

                        y: {
                            beginAtZero: true,
                            grid: {
                                color: horizontal
                                    ? "rgba(145,160,187,0.09)"
                                    : "transparent"
                            },
                            border: {
                                display: false
                            },
                            ticks: {
                                precision: 0
                            }
                        }
                    },

                onClick(event, elements) {
                    if (!elements.length) return;

                    handleChartClick(definition, elements[0]);
                }
            }
        });
    });
}


/* =========================================================
   CHART DATA
   ========================================================= */

function makeDataset(label, values, index, type) {
    const color = getChartColor(index);

    if (type === "doughnut") {
        return {
            label,
            data: values,
            backgroundColor: values.map((_, i) => getChartColor(i)),
            borderColor: "#131b2e",
            borderWidth: 3,
            hoverOffset: 8
        };
    }

    return {
        label,
        data: values,
        backgroundColor: color,
        borderColor: color,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 38
    };
}

function updateChart(definition) {
    const chart = charts[definition.id];

    if (!chart) return;

    const field = definition.field;
    const categories = uniqueValues(filteredData, field);

    chart.data.labels = categories;

    if (definition.groupBy) {
        const groups = uniqueValues(
            filteredData,
            definition.groupBy
        );

        chart.data.datasets = groups.map((group, index) => {
            const values = categories.map(category =>
                filteredData.filter(row =>
                    getValue(row, field) === category &&
                    getValue(row, definition.groupBy) === group
                ).length
            );

            return makeDataset(
                group,
                values,
                index,
                definition.type
            );
        });
    } else {
        const counts = new Map(countBy(filteredData, field));

        const values = categories.map(category =>
            counts.get(category) || 0
        );

        chart.data.datasets = [
            makeDataset(
                "Responses",
                values,
                0,
                definition.type
            )
        ];
    }

    chart.update("none");
}


/* =========================================================
   CHART INTERACTIONS
   ========================================================= */

function handleChartClick(definition, element) {
    const chart = charts[definition.id];

    if (!chart) return;

    if (definition.groupBy) {
        /*
          Grouped chart:
          Clicking a bar filters the category on the x-axis.
          The series (dataset) represents the grouping variable.
        */
        const category = chart.data.labels[element.index];
        const group = chart.data.datasets[element.datasetIndex]?.label;

        if (!category || !group) return;

        const field = definition.field;
        const value = category;

        if (activeChartFilters[field] === value) {
            delete activeChartFilters[field];
        } else {
            activeChartFilters[field] = value;
        }
    } else {
        const value = chart.data.labels[element.index];

        if (!value) return;

        const field = definition.field;

        if (activeChartFilters[field] === value) {
            delete activeChartFilters[field];
        } else {
            activeChartFilters[field] = value;
        }
    }

    syncFilterControls();
    applyFilters();
}

function syncFilterControls() {
    const mapping = {
        tool: "filter-tool",
        year: "filter-year",
        frequency: "filter-frequency",
        experience: "filter-experience"
    };

    Object.entries(mapping).forEach(([field, id]) => {
        const select = document.getElementById(id);

        if (!select) return;

        const value = activeChartFilters[field] || "all";

        select.value = [...select.options].some(
            option => option.value === value
        ) ? value : "all";
    });
}


/* =========================================================
   PAGE NAVIGATION
   ========================================================= */

function setupNavigation() {
    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => {
            const pageName = button.dataset.page;

            document.querySelectorAll(".nav-item").forEach(item => {
                item.classList.toggle("active", item === button);
            });

            document.querySelectorAll(".page").forEach(page => {
                page.classList.toggle(
                    "active",
                    page.id === `page-${pageName}`
                );
            });

            setText("breadcrumb-title", button.textContent.trim());

            requestAnimationFrame(() => {
                Object.values(charts).forEach(chart => chart.resize());
            });
        });
    });
}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showDataError(message) {
    const main = document.querySelector(".main-content");

    if (!main) return;

    let panel = document.getElementById("data-error");

    if (!panel) {
        panel = document.createElement("section");
        panel.id = "data-error";
        panel.setAttribute("role", "alert");

        panel.style.cssText = [
            "margin:20px 0",
            "padding:20px",
            "border:1px solid #9b5264",
            "border-radius:12px",
            "background:#281622",
            "color:#ffdce5"
        ].join(";");

        main.prepend(panel);
    }

    panel.innerHTML = `
        <h2 style="font-size:16px;margin-bottom:8px;">
            Dashboard data could not be loaded
        </h2>
        <p style="font-size:12px;">
            ${String(message).replace(/[&<>"']/g, char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[char])}
        </p>
        <p style="font-size:12px;margin-top:8px;">
            Check that ai_tools_cleaned.csv is in the project folder
            and open the dashboard using a local development server.
        </p>
    `;
}


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", loadCSV);
