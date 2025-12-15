import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dashboardApi } from '../../services/dashboardApi';
import logoGif from '../../assets/logo.gif';


// --- HELPER FUNCTIONS & MOCK API ---

const calculateDataQuality = (data) => {
    if (!data || data.length === 0) return {};
    const headers = Object.keys(data[0]);
    const report = {};

    headers.forEach(header => {
        const values = data.map(row => row[header]).filter(val => val !== null && val !== undefined && String(val).trim() !== '');
        
        let type = 'categorical';
        const isNumeric = values.every(val => !isNaN(parseFloat(val)) && isFinite(val));
        const isTemporal = !isNumeric && values.every(val => !isNaN(new Date(val).getTime()));

        if (isNumeric) type = 'numeric';
        if (isTemporal) type = 'temporal';
        
        const missingCount = data.length - values.length;
        const uniqueValues = new Set(values);
        
        let mean = null, min = null, max = null, outlierCount = 0;

        if (type === 'numeric' && values.length > 0) {
            const numericValues = values.map(parseFloat).sort((a, b) => a - b);
            mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
            min = numericValues[0];
            max = numericValues[numericValues.length - 1];

            const q1 = numericValues[Math.floor(numericValues.length / 4)];
            const q3 = numericValues[Math.floor((numericValues.length * 3) / 4)];
            const iqr = q3 - q1;
            const lowerBound = q1 - 1.5 * iqr;
            const upperBound = q3 + 1.5 * iqr;
            outlierCount = numericValues.filter(v => v < lowerBound || v > upperBound).length;
        }

        report[header] = {
            type,
            missingCount,
            missingPercentage: ((missingCount / data.length) * 100).toFixed(2),
            uniqueCount: uniqueValues.size,
            mean: mean ? mean.toFixed(2) : 'N/A',
            min,
            max,
            outlierCount
        };
    });

    return report;
};

const getGeminiChartRecommendations = async (metadata) => {
    console.log("Sending metadata to Gemini for dashboard recommendations:", metadata);
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    const recommendations = [];
    if (!metadata || Object.keys(metadata).length === 0) return recommendations;
    
    const headers = Object.keys(metadata);
    const numericColsAll = headers.filter(h => metadata[h].type === 'numeric');
    const categoricalCols = headers.filter(h => metadata[h].type === 'categorical');
    const temporalCols = headers.filter(h => metadata[h].type === 'temporal');

    const numericKeywords = ['revenue', 'sales', 'amount', 'cost', 'profit', 'asset', 'liabilities', 'equity', 'value', 'price', 'quantity', 'count', 'total', 'income', 'expense', 'budget'];
    const potentialKpiCols = headers.filter(h => metadata[h].type === 'numeric' && numericKeywords.some(k => h.toLowerCase().includes(k)));

    potentialKpiCols.slice(0, 4).forEach(col => {
        const isCurrency = ['price', 'revenue', 'cost', 'sales', 'amount', 'profit', 'income', 'expense'].some(k => col.toLowerCase().includes(k));
        recommendations.push({
            id: `kpi-${col}-sum`, type: 'kpi', title: `Total ${col}`, valueKey: col, calculation: 'sum',
            prefix: isCurrency ? '$' : ''
        });
        recommendations.push({
            id: `kpi-${col}-avg`, type: 'kpi', title: `Average ${col}`, valueKey: col, calculation: 'average',
            prefix: isCurrency ? '$' : ''
        });
    });
     if (categoricalCols.length > 0) {
        recommendations.push({
            id: 'kpi-total-rows', type: 'kpi', title: 'Total Records', value: Object.values(metadata)[0].missingCount + Object.values(metadata)[0].uniqueCount, calculation: 'value'
        });
    }

    const primaryNumeric = potentialKpiCols[0] || numericColsAll[0];
    const dateCol = temporalCols[0];
    const primaryCategorical = categoricalCols.find(c => metadata[c].uniqueCount > 1 && metadata[c].uniqueCount < 20) || categoricalCols[0];
    
    if (dateCol && primaryNumeric) {
        recommendations.push({
            id: `chart-line-${primaryNumeric}`, type: 'chart', chartType: 'line', x_axis: dateCol, y_axis: primaryNumeric,
            title: `${primaryNumeric} over Time`, defaultSort: 'asc', span: 'lg:col-span-2', forecast: true,
            insight: `The trend for ${primaryNumeric} shows seasonal fluctuations with overall growth.`,
            description: `Tracks the trend of '${primaryNumeric}' over time.`
        });
    }

    if (primaryCategorical && primaryNumeric) {
        const secondaryCategorical = categoricalCols.find(c => c !== primaryCategorical && metadata[c].uniqueCount > 1 && metadata[c].uniqueCount < 5);
        if (secondaryCategorical) {
             recommendations.push({
                id: `chart-bar-stacked-${primaryNumeric}`, type: 'chart', chartType: 'bar', x_axis: primaryCategorical, y_axis: primaryNumeric, stack_by: secondaryCategorical,
                title: `${primaryNumeric} by ${primaryCategorical} (by ${secondaryCategorical})`, defaultSort: 'desc', span: 'lg:col-span-2',
                insight: `The composition of ${primaryNumeric} varies significantly across different ${secondaryCategorical} segments.`,
                description: `A stacked bar chart showing the breakdown of ${primaryNumeric} for each ${primaryCategorical}.`
            });
        } else {
             recommendations.push({
                id: `chart-bar-${primaryNumeric}`, type: 'chart', chartType: 'bar', x_axis: primaryCategorical, y_axis: primaryNumeric,
                title: `Total ${primaryNumeric} by ${primaryCategorical}`, defaultSort: 'desc', span: 'lg:col-span-1',
                insight: `Category '${primaryCategorical}' has the highest impact on ${primaryNumeric}.`,
                description: `Compares total ${primaryNumeric} across different categories of ${primaryCategorical}.`
            });
        }
    }
    
    if (primaryCategorical) {
        recommendations.push({
            id: `chart-pie-${primaryCategorical}`, type: 'chart', chartType: 'pie', x_axis: primaryCategorical, y_axis: null,
            title: `Distribution of ${primaryCategorical}`, defaultSort: 'desc', span: 'lg:col-span-1',
            insight: `The dataset is dominated by a few key segments in ${primaryCategorical}.`,
            description: `Shows the proportion of each category in '${primaryCategorical}'.`
        });
    }
    
    if (numericColsAll.length >= 2) {
        const otherNumeric = numericColsAll.find(c => c !== primaryNumeric);
        if (otherNumeric) {
            recommendations.push({
                id: `chart-scatter-${primaryNumeric}`, type: 'chart', chartType: 'scatter', x_axis: primaryNumeric, y_axis: otherNumeric,
                title: `Correlation between ${primaryNumeric} and ${otherNumeric}`, span: 'lg:col-span-2',
                insight: `Shows the relationship between ${primaryNumeric} and ${otherNumeric}, highlighting potential correlations.`,
                description: `A scatter plot to investigate the relationship between two numerical variables.`
            });
        }
    }

    return recommendations;
};

const getChartSuggestionsForColumns = async (selectedColumnsMetadata) => {
    // ... (This function remains unchanged)
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate AI model thinking
    const suggestions = [];
    const types = selectedColumnsMetadata.map(m => m.type);
    const names = selectedColumnsMetadata.map(m => m.name);

    const numericCount = types.filter(t => t === 'numeric').length;
    const categoricalCount = types.filter(t => t === 'categorical').length;
    const temporalCount = types.filter(t => t === 'temporal').length;

    if (selectedColumnsMetadata.length === 1) {
        if (numericCount === 1) {
            suggestions.push({
                chartType: 'Histogram',
                explanation: `A histogram is excellent for understanding the distribution of a single numerical variable like **'${names[0]}'**. It shows where most values are concentrated and reveals the shape of your data (e.g., normal, skewed).`,
                config: { type: 'chart', chartType: 'bar', x_axis: names[0], isHistogram: true, title: `Distribution of ${names[0]}` }
            });
        }
        if (categoricalCount === 1) {
            suggestions.push({
                chartType: 'Bar Chart',
                explanation: `A bar chart effectively displays the frequency of each category in **'${names[0]}'**. It's perfect for comparing counts across different groups.`,
                config: { type: 'chart', chartType: 'bar', x_axis: names[0], y_axis: null, title: `Count of ${names[0]}` }
            });
            suggestions.push({
                chartType: 'Pie Chart',
                explanation: `A pie chart shows the proportion of each category in **'${names[0]}'** relative to the whole. Use it to highlight compositional breakdowns.`,
                config: { type: 'chart', chartType: 'pie', x_axis: names[0], y_axis: null, title: `Distribution of ${names[0]}` }
            });
        }
    } else if (selectedColumnsMetadata.length === 2) {
        if (numericCount === 1 && categoricalCount === 1) {
            const num = names[types.indexOf('numeric')];
            const cat = names[types.indexOf('categorical')];
            suggestions.push({
                chartType: 'Bar Chart',
                explanation: `This bar chart compares the total (or average) of **'${num}'** across each category of **'${cat}'**. It's ideal for seeing which categories have the highest or lowest values.`,
                config: { type: 'chart', chartType: 'bar', x_axis: cat, y_axis: num, title: `Total ${num} by ${cat}` }
            });
        }
        if (numericCount === 2) {
            suggestions.push({
                chartType: 'Scatter Plot',
                explanation: `A scatter plot is the best way to visualize the relationship between two numerical variables: **'${names[0]}'** and **'${names[1]}'**. It helps identify correlations, clusters, and outliers.`,
                config: { type: 'chart', chartType: 'scatter', x_axis: names[0], y_axis: names[1], title: `Correlation: ${names[0]} vs ${names[1]}` }
            });
        }
        if (numericCount === 1 && temporalCount === 1) {
             const num = names[types.indexOf('numeric')];
             const temp = names[types.indexOf('temporal')];
             suggestions.push({
                chartType: 'Line Chart',
                explanation: `A line chart effectively shows the trend of **'${num}'** over time (**'${temp}'**). It's perfect for tracking performance, growth, or fluctuations.`,
                config: { type: 'chart', chartType: 'line', x_axis: temp, y_axis: num, title: `${num} over Time` }
            });
        }
    }

    return suggestions;
};


// --- SVG ICONS ---
const UploadIcon=()=><svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3-3m3-3v12"/></svg>;
const ChartIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
const TableIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>;
const ExportIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>;
const InfoIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const NewDashboardIcon = ({className}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width={24} height={24} fill={"currentColor"} viewBox="0 0 24 24">
        <path className="db-1" d="m20,11h-6c-.55,0-1,.45-1,1v8c0,.55.45,1,1,1h6c.55,0,1-.45,1-1v-8c0-.55-.45-1-1-1Zm-1,8h-4v-6h4v6Z"></path>
        <path className="db-2" d="m10,15h-6c-.55,0-1,.45-1,1v4c0,.55.45,1,1,1h6c.55,0,1-.45,1-1v-4c0-.55-.45-1-1-1Zm-1,4h-4v-2h4v2Z"></path>
        <path className="db-3" d="m20,3h-6c-.55,0-1,.45-1,1v4c0,.55.45,1,1,1h6c.55,0,1-.45,1-1v-4c0-.55-.45-1-1-1Zm-1,4h-4v-2h4v2Z"></path>
        <path className="db-4" d="m10,3h-6c-.55,0-1,.45-1,1v8c0,.55.45,1,1,1h6c.55,0,1-.45,1-1V4c0-.55-.45-1-1-1Zm-1,8h-4v-6h4v6Z"></path>
    </svg>
);
const ArrowUpIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>;
const ArrowDownIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>;
const ShareIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/></svg>;
const ChatIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>;
const EditIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>;
const CheckCircleIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const ActivityIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>;
const TrashIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><g className="trash-lid"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" /></g><g className="trash-can"><path strokeLinecap="round" strokeLinejoin="round" d="M19 6v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></g></svg>;
const FilterIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>;
const EyeIcon = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <g className="eye-parts">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </g>
        <path className="eye-slash" strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" strokeDasharray="25.5" strokeDashoffset="25.5" />
    </svg>
);
const SettingsIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const UserIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const KeyIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H5v-2H3v-2H1v-4a6 6 0 016-6h4a6 6 0 016 6z" /></svg>;
const LogoutIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <g className="logout-arrow"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7" /></g>
    <path className="logout-door" strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
</svg>;
const ChatbotIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>;
const HistoryIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const WarningIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const ArrowLeftIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>;
const MenuIcon=({className})=><svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;


// --- REUSABLE COMPONENTS ---
const LoadingSpinner=({text="Processing..."})=><div className="flex flex-col items-center justify-center space-y-2"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#14FFEC]"></div><p className="text-[#14FFEC] text-sm font-semibold">{text}</p></div>;
const PrimaryButton=({onClick,children,className='',disabled=false})=><button onClick={onClick} disabled={disabled} className={`bg-[#0D7377] text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:bg-opacity-80 transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed transform hover:scale-105 ${className}`}>{children}</button>;
const Panel=({children,className=''})=><div className={`bg-[#323232] rounded-xl shadow-2xl p-6 md:p-8 ${className}`}>{children}</div>;
const Modal=({isOpen,onClose,title,children, size = 'md', className=''})=>{
    if(!isOpen)return null;
    const sizeClasses = { 'md': 'max-w-md', 'lg': 'max-w-2xl', 'xl': 'max-w-4xl' };
    return(<div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}><div className={`bg-[#323232] rounded-xl shadow-2xl w-full ${sizeClasses[size]} ${className}`} onClick={e=>e.stopPropagation()}><div className="p-6 border-b border-gray-700 flex justify-between items-center"><h2 className="text-2xl font-bold text-[#14FFEC]">{title}</h2><button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button></div><div className="p-6">{children}</div></div></div>);
};
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", isDestructive = true }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex items-start gap-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <WarningIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div>
                    <h3 className="text-lg leading-6 font-medium text-white">{title}</h3>
                    <div className="mt-2">
                        <p className="text-sm text-gray-300">{message}</p>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
                <button onClick={onClose} className="font-bold py-2 px-6 rounded-lg hover:bg-opacity-80 transition-all duration-300 bg-gray-600 text-white">Cancel</button>
                <button 
                    onClick={() => { onConfirm(); onClose(); }} 
                    className={`font-bold py-2 px-6 rounded-lg hover:bg-opacity-80 transition-all duration-300 ${isDestructive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#0D7377] hover:bg-[#0b5c5f] text-white'}`}
                >
                    {confirmText}
                </button>
            </div>
        </Modal>
    );
};
const InsightBox = ({ text }) => {
    if(!text) return null;
    return (
        <div className="bg-[#2a2a2a] p-3 rounded-lg mt-4 text-center text-sm text-gray-300 italic flex items-center gap-3">
            <InfoIcon className="h-6 w-6 text-[#14FFEC] flex-shrink-0"/>
            <span>{text}</span>
        </div>
    );
};

// --- APP SCREENS & MAJOR COMPONENTS ---
const FileUploadScreen = ({ onFileProcessed, XLSX, onShowViewShared, onShowHistory }) => {
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [showGoogleSheetModal, setShowGoogleSheetModal] = useState(false);
    const [sheetUrl, setSheetUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

    const processFile = (file) => {
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) {
            setError(`File size cannot exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
            return;
        }
        if (!['.csv', '.xlsx', '.xls'].some(ext => file.name.toLowerCase().endsWith(ext))) {
            setError('Invalid file type. Please upload a CSV or Excel file.');
            return;
        }
        setError('');
        setIsLoading(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                onFileProcessed(jsonData, file.name.split('.')[0]);
            } catch (err) {
                console.error("File processing error:", err);
                setError("Could not process the file. It might be corrupted or in an unsupported format.");
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
             setError("Failed to read the file.");
             setIsLoading(false);
        }
        reader.readAsArrayBuffer(file);
    };
    
    const handleConnectGoogleSheet = async () => {
        if (!sheetUrl) { alert('Please enter a Google Sheet URL.'); return; }
        setIsLoading(true);
        setError('');
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const sheetIdRegex = /\/d\/([a-zA-Z0-9-_]+)/;
            const match = sheetUrl.match(sheetIdRegex);
            if (!match) throw new Error("Invalid Google Sheet URL format.");
            const sheetId = match[1];
            const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

            const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
            if(!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const text = await response.text();

            if (text.length > MAX_FILE_SIZE) {
                throw new Error(`Google Sheet data is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
            }
            
            const workbook = XLSX.read(text, { type: 'string', raw: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            onFileProcessed(jsonData, "Google Sheet Data");
            setShowGoogleSheetModal(false);
        } catch (err) {
            console.error('Failed to fetch Google Sheet:', err);
            setError(err.message || 'Failed to fetch data. Ensure the link is public ("Anyone with the link can view").');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDragEvents = (e, isEntering) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(isEntering);
    };
    const handleDrop = e => {
        handleDragEvents(e, false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            processFile(files[0]);
        }
    };

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><div className="flex flex-col items-center justify-center space-y-4"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#14FFEC]"></div><p className="text-[#14FFEC] text-lg font-semibold">Processing Dataset...</p></div></div>
    }

    return (
        <div className="relative min-h-screen">
            <button onClick={onShowHistory} className="absolute top-6 right-6 p-3 bg-[#323232] rounded-full hover:bg-[#4a4a4a] transition-colors" title="View Dashboard History">
                <HistoryIcon className="h-6 w-6 text-white"/>
            </button>
            <div className="flex flex-col items-center justify-center min-h-screen p-4" onDragEnter={e => handleDragEvents(e, true)} onDragLeave={e => handleDragEvents(e, false)} onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
                <Modal isOpen={showGoogleSheetModal} onClose={() => setShowGoogleSheetModal(false)} title="Connect to Google Sheet">
                    <p className="text-gray-300 mb-4">Enter the public URL of your Google Sheet. Make sure sharing is set to "Anyone with the link".</p>
                    <input type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/..." className="w-full p-2 bg-[#212121] border border-gray-600 rounded-lg text-white mb-4"/>
                    <PrimaryButton onClick={handleConnectGoogleSheet} className="w-full">Connect</PrimaryButton>
                </Modal>
                <h1 className="text-5xl font-extrabold text-white mb-2">Vizora</h1>
                <h2 className="text-xl font-light text-[#14FFEC] mb-8">Data Cleaning Wizard & Visualization Dashboard</h2>
                <Panel className="w-full max-w-2xl text-center">
                    <input type="file" id="file-upload" className="hidden" accept=".csv, .xlsx, .xls" onChange={e => processFile(e.target.files[0])}/>
                    <label htmlFor="file-upload" className={`flex flex-col items-center justify-center w-full h-64 border-4 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ${dragging ? 'border-[#14FFEC] bg-[#3a3a3a]' : 'border-gray-600 hover:border-gray-500'}`}>
                        <UploadIcon/>
                        <p className="mt-4 text-lg text-gray-400"><span className="font-semibold text-[#0D7377]">Click to upload</span> or drag and drop</p>
                        <p className="text-sm text-gray-500">CSV, XLSX, or XLS files</p>
                    </label>
                    {error && <p className="text-red-400 mt-4">{error}</p>}
                    <div className="mt-4 text-center"><p className="text-gray-400">or</p><button onClick={() => setShowGoogleSheetModal(true)} className="mt-2 font-bold text-[#14FFEC] hover:underline">Connect to a Google Sheet</button></div>
                </Panel>
                <div className="mt-8 text-center">
                    <p className="text-gray-400">Have a share code?</p>
                    <button onClick={onShowViewShared} className="mt-2 font-bold text-[#14FFEC] hover:underline flex items-center gap-2 mx-auto">
                        <EyeIcon className="h-5 w-5" />
                        <span>View a Shared Dashboard</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
const AutoCleaningProgress = ({ data, onCleaningComplete, addToLog }) => {
    const initialDataWithIds = useMemo(() => data.map((row, index) => ({ ...row, __vizora_internal_id: index })), [data]);

    const [currentStep, setCurrentStep] = useState(-1);
    const [stepResults, setStepResults] = useState([]);
    const [lastStepChanges, setLastStepChanges] = useState([]);
    const [currentData, setCurrentData] = useState(initialDataWithIds);
    const [affectedRowIds, setAffectedRowIds] = useState(new Set());
    const [showAllChanges, setShowAllChanges] = useState(false);

    const cleaningSteps = useMemo(() => [
        { title: "Assess Data Quality", description: "Scanning for missing values, duplicates, and outliers.", action: (d) => ({ data: d, changes: [], summary: `Found ${d.length} rows.` }) },
        { title: "Remove Irrelevant or Redundant Data", description: "Consolidating duplicates.", action: (d) => { const changes = []; const seen = new Set(); const uniqueData = d.filter(row => { const { __vizora_internal_id, ...rowData } = row; const stringified = JSON.stringify(rowData); if (seen.has(stringified)) { changes.push({ id: row.__vizora_internal_id, type: 'duplicate' }); return false; } seen.add(stringified); return true; }); return { data: uniqueData, changes, summary: `Consolidated ${changes.length} duplicates.` }; } },
        { title: "Correct Structural Errors", description: "Fixing whitespace.", action: (d) => { const changes = []; const newData = d.map(row => { const newRow = { ...row }; Object.keys(newRow).forEach(key => { if (key !== '__vizora_internal_id' && typeof newRow[key] === 'string' && newRow[key].trim() !== newRow[key]) { changes.push({ id: row.__vizora_internal_id, key, before: newRow[key], after: newRow[key].trim(), type: 'correction' }); newRow[key] = newRow[key].trim(); } }); return newRow; }); return { data: newData, changes, summary: `Applied ${changes.length} structural corrections.` }; } },
        { title: "Handle Missing Data", description: "Filling empty cells using mean/mode.", action: (d) => { const changes = []; const newData = JSON.parse(JSON.stringify(d)); const headers = Object.keys(newData[0] || {}).filter(h => h !== '__vizora_internal_id'); headers.forEach(h => { const existingValues = d.map(r => r[h]).filter(v => v != null && String(v).trim() !== ''); const isNumeric = existingValues.every(v => !isNaN(parseFloat(v)) && isFinite(v)); let fillValue; if (isNumeric) { const sum = existingValues.reduce((acc, v) => acc + parseFloat(v), 0); fillValue = existingValues.length > 0 ? (sum / existingValues.length) : 0; } else { const counts = existingValues.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {}); fillValue = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, ''); } newData.forEach((row) => { if (row[h] == null || String(row[h]).trim() === '') { const finalFillValue = isNumeric ? parseFloat(fillValue.toFixed(2)) : fillValue; changes.push({ id: row.__vizora_internal_id, key: h, before: row[h], after: finalFillValue, type: 'filled' }); row[h] = finalFillValue; } }); }); return { data: newData, changes, summary: `Filled ${changes.length} missing values.` }; } },
        { title: "Manage Outliers", description: "Capping extreme values.", action: (d) => { const changes = []; const newData = JSON.parse(JSON.stringify(d)); const numericCols = Object.keys(d[0] || {}).filter(h => h !== '__vizora_internal_id' && d.every(r => r[h] === null || !isNaN(parseFloat(r[h])))); numericCols.forEach(key => { const values = d.map(r => parseFloat(r[key])).filter(v => !isNaN(v)).sort((a, b) => a - b); const q1 = values[Math.floor(values.length / 4)]; const q3 = values[Math.floor(values.length * 3 / 4)]; const iqr = q3 - q1; const lowerBound = q1 - 1.5 * iqr; const upperBound = q3 + 1.5 * iqr; newData.forEach((row) => { const val = parseFloat(row[key]); if (val < lowerBound || val > upperBound) { const cappedVal = parseFloat(Math.max(lowerBound, Math.min(val, upperBound)).toFixed(2)); changes.push({ id: row.__vizora_internal_id, key, before: val, after: cappedVal, type: 'adjusted' }); row[key] = cappedVal; } }); }); return { data: newData, changes, summary: `Adjusted ${changes.length} outliers.` }; } },
        { title: "Validate & Verify Accuracy", description: "Final check for consistency.", action: (d) => ({ data: d, changes: [], summary: "Data validated." }) },
    ], []);

    useEffect(() => {
        if (currentStep >= cleaningSteps.length) return;

        const timer = setTimeout(() => {
            if (currentStep > -1) {
                const step = cleaningSteps[currentStep];
                const result = step.action(currentData);
                
                setStepResults(prev => prev.map((r, i) => i === currentStep ? { ...r, summary: result.summary, status: 'completed' } : r));
                setCurrentData(result.data);
                setLastStepChanges(result.changes);
                if (result.changes.length > 0) {
                     setAffectedRowIds(prev => new Set([...prev, ...result.changes.map(c => c.id)]));
                }
                addToLog('AUTO_CLEAN', { step: step.title, details: result.summary });
            }
            
            const nextStep = currentStep + 1;
            if (nextStep < cleaningSteps.length) {
                setStepResults(prev => [...prev, { ...cleaningSteps[nextStep], status: 'processing' }]);
            }
            setCurrentStep(nextStep);

        }, 1500);

        return () => clearTimeout(timer);
    }, [currentStep, cleaningSteps, currentData, addToLog]);
    
    const isComplete = currentStep >= cleaningSteps.length;
    const headers = Object.keys(data[0] || {});
    const rowsToDisplay = useMemo(() => initialDataWithIds.filter(row => affectedRowIds.has(row.__vizora_internal_id)), [initialDataWithIds, affectedRowIds]);
    const displayedRows = showAllChanges ? rowsToDisplay : rowsToDisplay.slice(0, 10);

    return (
        <div className="min-h-screen flex flex-col p-4 md:p-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white">Auto Cleaning Wizard</h2>
                <p className="text-gray-400">Vizora is enhancing your data. Follow the live updates below.</p>
            </div>
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 flex flex-col gap-4">
                    {cleaningSteps.map((step, index) => {
                        const result = stepResults[index];
                        const status = result?.status || (index <= currentStep ? 'processing' : 'pending');
                        return (
                            <div key={index} className={`bg-[#323232] p-4 rounded-lg transition-all duration-500 ${status === 'processing' ? 'ring-2 ring-[#14FFEC]' : ''}`}>
                                <div className="flex items-center gap-4">
                                    {status === 'completed' ? <CheckCircleIcon className="h-6 w-6 text-green-400"/> : status === 'processing' ? <div className="h-6 w-6"><LoadingSpinner text=""/></div> : <div className="h-6 w-6 rounded-full bg-gray-500"/>}
                                    <div>
                                        <h3 className="font-semibold text-white">{step.title}</h3>
                                        <p className="text-sm text-gray-400">{result?.summary || step.description}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="lg:col-span-2 bg-[#323232] rounded-xl p-4 flex flex-col">
                    <h3 className="text-xl font-bold text-white mb-4">Live Data Preview of Changes</h3>
                    <div className="flex-grow overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="sticky top-0 bg-[#323232]">
                                <tr className="text-gray-400">
                                    {headers.map(h => <th key={h} className="p-2 font-normal border-b border-gray-600">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRows.length === 0 && (
                                    <tr><td colSpan={headers.length} className="text-center p-8 text-gray-500">No changes detected yet...</td></tr>
                                )}
                                {displayedRows.map((originalRow) => {
                                    const updatedRow = currentData.find(r => r.__vizora_internal_id === originalRow.__vizora_internal_id);
                                    if (!updatedRow) { // Row was a duplicate and got removed
                                        return (<tr key={originalRow.__vizora_internal_id} className="bg-red-900/50 opacity-50"><td colSpan={headers.length} className="p-2 text-center italic">Row consolidated</td></tr>);
                                    }
                                    return (
                                        <tr key={originalRow.__vizora_internal_id} className="border-b border-gray-700">
                                            {headers.map(key => {
                                                const cellChange = lastStepChanges.find(c => c.id === originalRow.__vizora_internal_id && c.key === key);
                                                let cellClass = "p-2 whitespace-nowrap transition-colors duration-500";
                                                let content = updatedRow[key];
                                                
                                                if(cellChange) {
                                                    if(cellChange.type === 'filled') cellClass += " bg-blue-500/30";
                                                    if(cellChange.type === 'adjusted') cellClass += " bg-yellow-500/30";
                                                    if(cellChange.type === 'correction') cellClass += " bg-purple-500/30";
                                                    content = <div className="flex flex-col"><span className="text-xs text-red-400 line-through">{String(cellChange.before)}</span><span>{String(cellChange.after)}</span></div>;
                                                }
                                                return <td key={key} className={cellClass}>{typeof content === 'object' ? content : String(content)}</td>
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {rowsToDisplay.length > 10 && !showAllChanges && (
                        <div className="text-center mt-4 flex-shrink-0">
                            <button
                                onClick={() => setShowAllChanges(true)}
                                className="text-[#14FFEC] font-semibold hover:underline"
                            >
                                Show All {rowsToDisplay.length} Changed Rows
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="text-center mt-8">
                <PrimaryButton onClick={() => onCleaningComplete(currentData.map(({__vizora_internal_id, ...rest}) => rest))} disabled={!isComplete}>
                    {isComplete ? 'Apply & Continue' : 'Processing...'}
                </PrimaryButton>
            </div>
        </div>
    );
};
const ManualCleaningWizard = ({ originalData, onCleaningComplete, addToLog }) => {
    const [step, setStep] = useState(0);
    const [data, setData] = useState(JSON.parse(JSON.stringify(originalData)));
    const [qualityReport, setQualityReport] = useState(null);
    const [selectedColumn, setSelectedColumn] = useState('');
    const [fillValue, setFillValue] = useState('');
    
    const maxSteps = 4;

    useEffect(() => { setQualityReport(calculateDataQuality(data)); }, [data]);
    const handleNext = () => setStep(s => Math.min(maxSteps, s + 1));
    const handlePrevious = () => setStep(s => Math.max(0, s - 1));
    const handleFinish = () => {
        addToLog('MANUAL_CLEAN_FINISH', { details: 'Manual cleaning process completed.' });
        onCleaningComplete(data);
    };
    
    const createLogAndSetData = (newData, logDetails) => {
        setData(newData);
        addToLog('MANUAL_CLEAN', logDetails);
    };

    const handleTrimWhitespace = () => {
        let changed = 0;
        const newData = data.map(row => { const newRow = {...row}; Object.keys(newRow).forEach(key => { if(typeof newRow[key] === 'string' && newRow[key].trim() !== newRow[key]) { newRow[key] = newRow[key].trim(); changed++; } }); return newRow; });
        createLogAndSetData(newData, { action: 'Trim Whitespace', details: `Trimmed ${changed} cells.` });
    };
    const handleChangeCase = (column, caseType) => {
        const newData = data.map(row => ({...row, [column]: String(row[column])[caseType]() }));
        createLogAndSetData(newData, { action: 'Change Case', details: `Converted column '${column}' to ${caseType}.` });
    };
    const handleDropMissing = (column) => {
        const initialCount = data.length;
        const newData = data.filter(row => row[column] != null && String(row[column]).trim() !== '');
        createLogAndSetData(newData, { action: 'Drop Missing', details: `Dropped ${initialCount - newData.length} rows from '${column}'.` });
    };
    const handleFillMean = (column) => {
        const mean = parseFloat(qualityReport[column].mean);
        if (isNaN(mean)) return;
        const newData = data.map(row => { const newRow = {...row}; if(newRow[column] == null || String(newRow[column]).trim() === '') newRow[column] = mean; return newRow; });
        createLogAndSetData(newData, { action: 'Fill Mean', details: `Filled missing in '${column}' with ${mean.toFixed(2)}.` });
    };
     const handleFillCustom = (column, value) => {
        if (value === '') return;
        let finalValue = value;
        if (qualityReport[column].type === 'numeric') { finalValue = parseFloat(value); if (isNaN(finalValue)) { alert("Please enter a valid number."); return; }}
        const newData = data.map(row => { const newRow = {...row}; if(newRow[column] == null || String(newRow[column]).trim() === '') newRow[column] = finalValue; return newRow; });
        createLogAndSetData(newData, { action: 'Fill Custom', details: `Filled missing in '${column}' with '${finalValue}'.` });
    };
     const handleRemoveOutliers = (column) => {
        const numericValues = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v)).sort((a,b) => a - b);
        const q1 = numericValues[Math.floor(numericValues.length / 4)]; const q3 = numericValues[Math.floor((numericValues.length * 3) / 4)]; const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr; const upperBound = q3 + 1.5 * iqr;
        const initialCount = data.length;
        const newData = data.filter(row => { const val = parseFloat(row[column]); return isNaN(val) || (val >= lowerBound && val <= upperBound); });
        createLogAndSetData(newData, { action: 'Remove Outliers', details: `Removed ${initialCount - newData.length} outlier rows from '${column}'.` });
    };
     const handleRemoveDuplicates = () => {
        const initialCount = data.length;
        const seen = new Set();
        const uniqueData = data.filter(row => { const stringified = JSON.stringify(row); if(seen.has(stringified)) return false; seen.add(stringified); return true; });
        createLogAndSetData(uniqueData, { action: 'Remove Duplicates', details: `Removed ${initialCount - uniqueData.length} duplicate rows.` });
    };

    const renderStepContent = () => {  
         switch(step) {
            case 0: return (<div><h3 className="text-2xl font-bold text-[#14FFEC] mb-4">Step 1: Data Quality Assessment</h3><p className="text-gray-300 mb-6">Review a summary of your dataset, including outliers detected via the IQR method.</p><div className="overflow-x-auto max-h-96"><table className="w-full text-left text-sm"><thead className="bg-[#2a2a2a] text-gray-300 uppercase"><tr><th className="p-3">Column</th><th className="p-3">Type</th><th className="p-3">Missing</th><th className="p-3">Unique</th><th className="p-3">Outliers</th></tr></thead><tbody>{qualityReport && Object.entries(qualityReport).map(([h, r]) => (<tr key={h} className="border-b border-gray-700"><td className="p-3 font-medium text-white">{h}</td><td className="p-3 capitalize">{r.type}</td><td className="p-3">{r.missingCount} ({r.missingPercentage}%)</td><td className="p-3">{r.uniqueCount}</td><td className="p-3">{r.type === 'numeric' ? r.outlierCount : 'N/A'}</td></tr>))}</tbody></table></div></div>);
            case 1: const textColumns = qualityReport ? Object.keys(qualityReport).filter(k => qualityReport[k].type === 'categorical') : []; return (<div><h3 className="text-2xl font-bold text-[#14FFEC] mb-4">Step 2: Structural Error Fixes</h3><p className="text-gray-300 mb-6">Standardize text data by trimming whitespace or changing case.</p><div className="space-y-4"><PrimaryButton onClick={handleTrimWhitespace}>Trim Whitespace (All Columns)</PrimaryButton><div className="flex items-center gap-4"><select onChange={e => setSelectedColumn(e.target.value)} defaultValue="" className="flex-grow p-2 bg-[#212121] border border-gray-600 rounded-lg text-white"><option value="">-- Select Text Column --</option>{textColumns.map(c => <option key={c} value={c}>{c}</option>)}</select><PrimaryButton onClick={() => handleChangeCase(selectedColumn, 'toUpperCase')} disabled={!selectedColumn}>UPPER</PrimaryButton><PrimaryButton onClick={() => handleChangeCase(selectedColumn, 'toLowerCase')} disabled={!selectedColumn}>lower</PrimaryButton></div></div></div>);
            case 2: const columnsWithMissing = qualityReport ? Object.keys(qualityReport).filter(k => qualityReport[k].missingCount > 0) : []; return (<div><h3 className="text-2xl font-bold text-[#14FFEC] mb-4">Step 3: Handle Missing Values</h3><p className="text-gray-300 mb-6">Choose how to handle empty cells in your data.</p>{columnsWithMissing.length > 0 ? (<div className="space-y-4"><select value={selectedColumn} onChange={e => { setSelectedColumn(e.target.value); setFillValue(''); }} className="w-full p-2 bg-[#212121] border border-gray-600 rounded-lg text-white"><option value="">-- Select a Column --</option>{columnsWithMissing.map(c => <option key={c} value={c}>{c} ({qualityReport[c].missingCount} missing)</option>)}</select>{selectedColumn && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><PrimaryButton onClick={() => handleDropMissing(selectedColumn)}>Drop Rows</PrimaryButton><PrimaryButton onClick={() => handleFillMean(selectedColumn)} disabled={qualityReport[selectedColumn].type !== 'numeric'}>Fill with Mean</PrimaryButton><div className="md:col-span-2 flex gap-2"><input type="text" value={fillValue} onChange={e => setFillValue(e.target.value)} placeholder="Custom fill value" className="flex-grow p-2 bg-[#212121] border border-gray-600 rounded-lg text-white"/><PrimaryButton onClick={() => handleFillCustom(selectedColumn, fillValue)}>Fill Custom</PrimaryButton></div></div>)}</div>) : <p className="text-green-400">No missing values detected!</p>}</div>);
            case 3: const columnsWithOutliers = qualityReport ? Object.keys(qualityReport).filter(k => qualityReport[k].outlierCount > 0) : []; return (<div><h3 className="text-2xl font-bold text-[#14FFEC] mb-4">Step 4: Manage Outliers</h3><p className="text-gray-300 mb-6">Remove rows containing extreme values that could skew analysis.</p>{columnsWithOutliers.length > 0 ? (<div className="flex items-center gap-4"><select onChange={e => setSelectedColumn(e.target.value)} defaultValue="" className="flex-grow p-2 bg-[#212121] border border-gray-600 rounded-lg text-white"><option value="">-- Select Numeric Column --</option>{columnsWithOutliers.map(c => <option key={c} value={c}>{c} ({qualityReport[c].outlierCount} outliers)</option>)}</select><PrimaryButton onClick={() => handleRemoveOutliers(selectedColumn)} disabled={!selectedColumn}>Remove Outlier Rows</PrimaryButton></div>) : <p className="text-green-400">No significant outliers detected.</p>}</div>);
            case 4: const duplicateCount = data.length - new Set(data.map(row => JSON.stringify(row))).size; return (<div><h3 className="text-2xl font-bold text-[#14FFEC] mb-4">Step 5: Remove Duplicates</h3><p className="text-gray-300 mb-6">Find and remove identical rows from your dataset.</p>{duplicateCount > 0 ? (<div className="text-center p-6 bg-[#2a2a2a] rounded-lg"><p className="text-2xl font-bold text-yellow-400">{duplicateCount} duplicate rows found.</p><PrimaryButton onClick={handleRemoveDuplicates} className="mt-4">Remove Duplicates</PrimaryButton></div>) : <p className="text-green-400 text-lg">No duplicate rows found!</p>}</div>);
            default: return null;
        }
    }
    
    return (
        <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-6xl">
                <Panel>
                    {renderStepContent()}
                    <div className="mt-8 flex justify-between">
                        <PrimaryButton onClick={handlePrevious} disabled={step === 0}>Previous</PrimaryButton>
                        {step < maxSteps ? <PrimaryButton onClick={handleNext}>Next</PrimaryButton> : <PrimaryButton onClick={handleFinish}>Finish & Generate Dashboard</PrimaryButton>}
                    </div>
                </Panel>
            </div>
        </div>
    );
};
const Dashboard = ({ currentDashboardId, dashboardName, setDashboardName, cleanedData, setCleanedData, dashboardWidgets, setDashboardWidgets, onReset, onSave, libraries, addToLog, isReadOnly, onLoadShared, onShowViewShared, savedDashboards, onLoadDashboard, onRenameDashboard, onDeleteDashboard, onDeleteHistory, onLogout, onShowHistory }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showChartBuilderModal, setShowChartBuilderModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(false);
    const [loadingCharts, setLoadingCharts] = useState(!dashboardWidgets || dashboardWidgets.length === 0);
    const [drilldownHistory, setDrilldownHistory] = useState([]); 
    const [filterModalState, setFilterModalState] = useState({ isOpen: false, widgetId: null });
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    useEffect(() => {
        const autoSave = setTimeout(() => {
          if (!isReadOnly && currentDashboardId) { 
            onSave();
          }
        }, 3000); // Increased delay to avoid rapid saves
        return () => clearTimeout(autoSave);
    }, [dashboardName, dashboardWidgets, cleanedData, isReadOnly, currentDashboardId, onSave]);

    const qualityReport = useMemo(() => calculateDataQuality(cleanedData), [cleanedData]);
    const headers = useMemo(() => cleanedData.length > 0 ? Object.keys(cleanedData[0]) : [], [cleanedData]);
    
    const filteredData = useMemo(() => {
        if (drilldownHistory.length === 0) return cleanedData;
        const lastFilter = drilldownHistory[drilldownHistory.length - 1];
        return cleanedData.filter(row => String(row[lastFilter.key]) === String(lastFilter.value));
    }, [cleanedData, drilldownHistory]);

    useEffect(() => {
        if (!dashboardWidgets || dashboardWidgets.length === 0) {
            const fetchRecommendations = async () => {
                setLoadingCharts(true);
                const metadata = calculateDataQuality(filteredData);
                const recommendations = await getGeminiChartRecommendations(metadata);
                setDashboardWidgets(recommendations);
                setLoadingCharts(false);
            };
            fetchRecommendations();
        } else {
             setLoadingCharts(false);
        }
    }, [filteredData, dashboardWidgets, setDashboardWidgets]);
    
    const handleDrilldown = (key, value) => {
        setDrilldownHistory(prev => [...prev, { key, value }]);
        addToLog('DRILLDOWN', { details: `Filtered by ${key} = ${value}` });
    };

    const handleResetDrilldown = () => {
        const lastFilter = drilldownHistory[drilldownHistory.length - 1];
        setDrilldownHistory(prev => prev.slice(0, -1));
        addToLog('DRILLDOWN_RESET', { details: `Removed filter on ${lastFilter.key}` });
    };
    
    const handleAddChart = (chartConfig) => {
        const newWidget = { ...chartConfig, id: `custom-${Date.now()}` };
        setDashboardWidgets(prev => [...prev, newWidget]);
        addToLog('CHART_ADDED', { title: newWidget.title });
        setShowChartBuilderModal(false);
    };
    
    const handleRemoveWidget = (widgetId, widgetTitle) => {
        setDashboardWidgets(prev => prev.filter(w => w.id !== widgetId));
        addToLog('CHART_REMOVED', { title: widgetTitle });
    };
    
    const handleDataEdit = (newData, logDetails) => {
        setCleanedData(newData);
        addToLog('DATA_EDIT', logDetails);
    };
    
    const handleApplyFilter = (widgetId, filter) => {
        setDashboardWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, filter } : w));
        const widget = dashboardWidgets.find(w => w.id === widgetId);
        addToLog('FILTER_APPLIED', { details: `Filter applied to '${widget.title}'. Column: ${filter.column}, Values: ${filter.values.join(', ')}` });
        setFilterModalState({ isOpen: false, widgetId: null });
    };

    const currentFilteringWidget = useMemo(() => {
        return dashboardWidgets.find(w => w.id === filterModalState.widgetId);
    }, [filterModalState, dashboardWidgets]);

    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                isReadOnly={isReadOnly}
                onShowViewShared={onShowViewShared}
                onToggleActivity={() => setIsActivityPanelOpen(p => !p)}
                onReset={onReset}
                savedDashboards={savedDashboards}
                onLoadDashboard={onLoadDashboard}
                onRenameDashboard={onRenameDashboard}
                onDeleteDashboard={onDeleteDashboard}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(p => !p)}
                onDeleteHistory={onDeleteHistory}
                onLogout={onLogout}
            />
            <main className={`flex-1 bg-[#212121] p-4 md:p-8 overflow-y-auto transition-all duration-300 ease-in-out ${isActivityPanelOpen && !isReadOnly ? 'mr-96' : ''}`}>
                {activeTab === 'dashboard' && <DashboardView dashboardName={dashboardName} setDashboardName={setDashboardName} data={filteredData} widgets={dashboardWidgets} setWidgets={setDashboardWidgets} loading={loadingCharts} ChartJS={libraries.ChartJS} activeDrilldown={drilldownHistory.length > 0 ? drilldownHistory[drilldownHistory.length-1] : null} onDrilldown={handleDrilldown} onResetDrilldown={handleResetDrilldown} onShowChartBuilder={() => setShowChartBuilderModal(true)} onShowShare={() => setShowShareModal(true)} onRemoveWidget={handleRemoveWidget} onOpenFilterModal={(widgetId) => setFilterModalState({ isOpen: true, widgetId })} onSave={onSave} currentDashboardId={currentDashboardId} addToLog={addToLog} isReadOnly={isReadOnly} onNewDashboard={onReset} onShowHistory={onShowHistory} />}
                {activeTab === 'preview' && !isReadOnly && <DataPreview data={cleanedData} headers={headers} onDataEdit={handleDataEdit} />}
                {activeTab === 'exports' && !isReadOnly && <Exports data={cleanedData} XLSX={libraries.XLSX} />}
            </main>
            {!isReadOnly && <ActivityPanel isOpen={isActivityPanelOpen} onClose={() => setIsActivityPanelOpen(false)} log={addToLog.log} />}
            {!isReadOnly && <ChartBuilderModal isOpen={showChartBuilderModal} onClose={() => setShowChartBuilderModal(false)} qualityReport={qualityReport} data={cleanedData} ChartJS={libraries.ChartJS} onAddChart={handleAddChart} />}
            <ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} stateToShare={{ cleanedData, headers, qualityReport, dashboardName, dashboardWidgets }} />
            {filterModalState.isOpen && <FilterModal widget={currentFilteringWidget} data={cleanedData} onClose={() => setFilterModalState({ isOpen: false, widgetId: null })} onApplyFilter={handleApplyFilter} />}
        </div>
    );
};
// --- NESTED DASHBOARD COMPONENTS ---
const Sidebar = ({ activeTab, setActiveTab, isReadOnly, onShowViewShared, onToggleActivity, onReset, savedDashboards, onLoadDashboard, onRenameDashboard, onDeleteDashboard, isCollapsed, onToggleCollapse, onDeleteHistory, onLogout }) => { 
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSettingsAnimating, setIsSettingsAnimating] = useState(false);
    
    const handleSettingsClick = () => {
        setIsSettingsAnimating(true);
        setIsSettingsOpen(true);
        setTimeout(() => setIsSettingsAnimating(false), 500);
    }
    
    const navItems = isReadOnly ? [
        { id: 'dashboard', label: 'Dashboard', icon: ChartIcon },
    ] : [
        { id: 'dashboard', label: 'Dashboard', icon: ChartIcon },
        { id: 'preview', label: 'Data Preview', icon: TableIcon },
        { id: 'exports', label: 'Exports', icon: ExportIcon },
    ];
    return (<>
        <aside className={`bg-[#323232] p-6 flex-shrink-0 flex flex-col justify-between transition-all duration-300 ${isCollapsed ? 'w-24 items-center' : 'w-64'}`}>
            <div className={`flex flex-col gap-8 flex-grow overflow-hidden ${isCollapsed ? 'w-full items-center' : ''}`}>
                <div className={`flex items-center justify-between mb-8 w-full`}>
                    <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0' : 'w-auto'}`}>
                        <div className="relative w-8 h-8 flex-shrink-0">
                            <div className="w-8 h-8 bg-black rounded-full"></div>
                            <img src={logoGif} alt="Vizora Logo" className="absolute inset-0 w-8 h-8 object-contain rounded-full" />
                        </div>
                        <h1 className="text-2xl font-bold text-white whitespace-nowrap">Vizora</h1>
                    </div>
                    <button onClick={onToggleCollapse} className="p-2 rounded-md hover:bg-[#4a4a4a]">
                        <MenuIcon className="h-6 w-6 text-white"/>
                    </button>
                </div>
                <nav className="flex flex-col gap-3 flex-shrink-0">{navItems.map(item => (<button key={item.id} title={isCollapsed ? item.label : ''} onClick={() => setActiveTab(item.id)} className={`flex items-center p-3 rounded-lg text-lg transition-colors duration-200 w-full ${isCollapsed ? 'justify-center' : 'text-left'} ${activeTab === item.id ? 'bg-[#0D7377] text-white shadow-md' : 'text-gray-300 hover:bg-[#4a4a4a]'}`}><item.icon className="h-6 w-6 flex-shrink-0" /> <span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>{item.label}</span></button>))}</nav>
                {!isReadOnly && <DashboardHistoryList dashboards={savedDashboards} onLoad={onLoadDashboard} onRename={onRenameDashboard} onDelete={onDeleteDashboard} isCollapsed={isCollapsed} />}
            </div>
            
            <div className="flex flex-col space-y-2 flex-shrink-0">
                {isReadOnly ? (
                    <button onClick={onReset} title={isCollapsed ? "Create Your Own" : ""} className={`flex items-center p-3 rounded-lg text-lg transition-colors duration-200 w-full ${isCollapsed ? 'justify-center' : 'text-left'} text-gray-300 hover:bg-[#4a4a4a]`}><NewDashboardIcon className="h-6 w-6 flex-shrink-0" /><span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>Create Your Own</span></button>
                ) : (
                    <>
                        <button onClick={() => alert("Chatbot feature coming soon!")} title={isCollapsed ? "New Chatbot" : ""} className={`flex items-center p-3 rounded-lg text-lg transition-colors duration-200 w-full ${isCollapsed ? 'justify-center' : 'text-left'} text-gray-300 hover:bg-[#4a4a4a]`}><ChatbotIcon className="h-6 w-6 flex-shrink-0" /><span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>New Chatbot</span></button>
                        <button onClick={handleSettingsClick} title={isCollapsed ? "Settings" : ""} className={`flex items-center p-3 rounded-lg text-lg transition-colors duration-200 w-full ${isCollapsed ? 'justify-center' : 'text-left'} text-gray-300 hover:bg-[#4a4a4a]`}><SettingsIcon className={`h-6 w-6 flex-shrink-0 ${isSettingsAnimating ? 'animate-gear-rotate' : ''}`} /><span className={`ml-3 whitespace-nowrap transition-all duration-200 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>Settings</span></button>
                    </>
                )}
            </div>
        </aside>
        {!isReadOnly && 
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)}
                onShowViewShared={onShowViewShared}
                onToggleActivity={onToggleActivity}
                onReset={onReset}
                onDeleteHistory={onDeleteHistory}
                onLogout={onLogout}
            />
        }
    </>);
};
const DataPreview = ({ data, headers, onDataEdit }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [originalValue, setOriginalValue] = useState('');

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        return data.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase())));
    }, [data, searchTerm]);
    
    const rowsPerPage = 10;
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage), [filteredData, currentPage]);

    const handleEditStart = (rowIndex, header, currentValue) => {
        const absoluteIndex = data.findIndex(d => d === paginatedData[rowIndex]);
        setEditingCell({ rowIndex: absoluteIndex, header });
        setEditValue(currentValue);
        setOriginalValue(currentValue);
    };
    const handleEditCommit = () => {
        if (!editingCell) return;
        const { rowIndex, header } = editingCell;
        const newData = [...data];
        const isNumeric = !isNaN(parseFloat(editValue)) && isFinite(editValue);
        const finalValue = isNumeric ? parseFloat(editValue) : editValue;
        newData[rowIndex] = { ...newData[rowIndex], [header]: finalValue };
        
        onDataEdit(newData, {
            details: `Row ${rowIndex + 1}, Column '${header}' changed from '${originalValue}' to '${finalValue}'.`
        });
        
        setEditingCell(null);
    };
    
    return (<Panel><div className="flex justify-between items-center mb-4"><h2 className="text-3xl font-bold text-[#14FFEC]">Data Preview</h2><input type="text" placeholder="Search table..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full max-w-sm p-2 bg-[#212121] border border-gray-600 rounded-lg text-white"/></div><p className="text-sm text-gray-400 mb-4">Double-click a cell to edit its value.</p><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-[#2a2a2a] text-gray-300 uppercase text-sm"><tr>{headers.map(h => <th key={h} className="p-4">{h}</th>)}</tr></thead><tbody>{paginatedData.map((row, rowIndex) => (<tr key={rowIndex} className="border-b border-gray-700 hover:bg-[#3a3a3a] transition-colors">{headers.map(header => (<td key={header} className="p-4 text-white whitespace-nowrap" onDoubleClick={() => handleEditStart(rowIndex, header, row[header])}>{editingCell && editingCell.rowIndex === data.findIndex(d => d === row) && editingCell.header === header ? (<input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleEditCommit} onKeyDown={e => {if(e.key === 'Enter') handleEditCommit(); if(e.key === 'Escape') setEditingCell(null);}} autoFocus className="bg-[#212121] text-white p-1 rounded w-full"/>) : String(row[header])}</td>))}</tr>))}</tbody></table></div><div className="flex justify-between items-center mt-4"><span className="text-gray-400">Page {currentPage} of {totalPages}</span><div className="flex gap-2"><PrimaryButton onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</PrimaryButton><PrimaryButton onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</PrimaryButton></div></div></Panel>);
};
const ChartComponent = React.memo(({ config, data, ChartJS, onDrilldown }) => {
    const canvasRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const [currentSort, setCurrentSort] = useState(config.defaultSort || 'asc');
    const [dataPage, setDataPage] = useState(0);
    const itemsPerPage = 10;
    
    const processDataForChart = useCallback((config, allData) => {
        let chartData = allData;
        if (config.filter && config.filter.values.length > 0) {
            const filterValues = new Set(config.filter.values);
            chartData = allData.filter(row => filterValues.has(row[config.filter.column]));
        }

        const { chartType, x_axis, y_axis, stack_by, isHistogram } = config;
        if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
        
        const chartColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#F0B37E', '#8A6FBE', '#50C878'];
        
        if (isHistogram) { const values = chartData.map(d => parseFloat(d[x_axis])).filter(v => !isNaN(v)); const min = Math.min(...values); const max = Math.max(...values); const binCount = 10; const binSize = (max - min) / binCount; const bins = Array(binCount).fill(0); const labels = []; for (let i = 0; i < binCount; i++) { labels.push(`${(min + i * binSize).toFixed(2)} - ${(min + (i + 1) * binSize).toFixed(2)}`); } values.forEach(value => { const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1); bins[binIndex]++; }); return { labels, datasets: [{ label: `Frequency of ${x_axis}`, data: bins, backgroundColor: chartColors[1] }]}; }
        if (chartType === 'scatter') { const scatterData = chartData.map(d => ({ x: parseFloat(d[x_axis]), y: parseFloat(d[y_axis]) })); return { datasets: [{ label: `${y_axis} vs ${x_axis}`, data: scatterData, backgroundColor: chartColors[0] }] }; }
        if (!y_axis) { const counts = chartData.reduce((acc, row) => { acc[row[x_axis]] = (acc[row[x_axis]] || 0) + 1; return acc; }, {}); const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]); return { labels: sorted.map(d => d[0]), datasets: [{ data: sorted.map(d => d[1]), backgroundColor: chartColors }] } }

        let sortedData = [...chartData].sort((a,b) => currentSort === 'desc' ? b[y_axis] - a[y_axis] : a[y_axis] - b[y_axis]);
        const isLargeDataset = [...new Set(sortedData.map(i => i[x_axis]))].length > 25;

        if (stack_by) { const labels = [...new Set(sortedData.map(item => item[x_axis]))]; const stackValues = [...new Set(sortedData.map(item => item[stack_by]))]; const datasets = stackValues.map((stackVal, i) => ({ label: stackVal, data: labels.map(label => { const items = sortedData.filter(d => d[x_axis] === label && d[stack_by] === stackVal); return items.reduce((sum, item) => sum + parseFloat(item[y_axis]), 0); }), backgroundColor: chartColors[i % chartColors.length], })); return { labels, datasets }; }
        if (isLargeDataset) { const start = dataPage * itemsPerPage; sortedData = sortedData.slice(start, start + itemsPerPage); }

        const labels = sortedData.map(row => row[x_axis]);
        const dataValues = sortedData.map(row => parseFloat(row[y_axis]));
        return { labels, datasets: [{ label: y_axis, data: dataValues, backgroundColor: chartColors, }] };
    }, [currentSort, dataPage]);


    useEffect(() => {
        if (!canvasRef.current || !ChartJS) return;
        const ctx = canvasRef.current.getContext('2d');
        if (chartInstanceRef.current) chartInstanceRef.current.destroy();

        const chartData = processDataForChart(config, data);

        chartInstanceRef.current = new ChartJS(ctx, {
            type: config.chartType, data: chartData,
            options: { responsive: true, maintainAspectRatio: false, onClick: (event, elements) => { if (elements.length > 0 && onDrilldown) onDrilldown(config.x_axis, chartData.labels[elements[0].index]); }, plugins: { legend: { labels: { color: '#E8F1F2' } }, title: { display: false } }, scales: (config.chartType !== 'pie' && config.chartType !== 'doughnut') ? { x: { ticks: { color: '#A9A9A9' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, stacked: !!config.stack_by }, y: { ticks: { color: '#A9A9A9' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }, stacked: !!config.stack_by, beginAtZero: true } } : {}, }
        });
        return () => { if (chartInstanceRef.current) chartInstanceRef.current.destroy(); };
    }, [config, data, processDataForChart, ChartJS, onDrilldown]);
    
    const isLargeDataset = data.length > 25 && config.chartType !== 'scatter';

    return (<div className="h-full flex flex-col relative"><div className="absolute top-2 right-2 z-10 flex gap-2">{onDrilldown && <button onClick={() => setCurrentSort(s => s === 'asc' ? 'desc' : 'asc')} className="p-1.5 bg-[#4a4a4a] hover:bg-[#5a5a5a] rounded-md transition-colors">{currentSort === 'asc' ? <ArrowUpIcon className="h-4 w-4 text-white" /> : <ArrowDownIcon className="h-4 w-4 text-white" />}</button>}</div><div className="flex-grow pt-8 relative"><canvas ref={canvasRef}></canvas></div>{isLargeDataset && <div className="px-4 pt-2"><input type="range" min="0" max={Math.ceil(data.length / itemsPerPage) - 1} value={dataPage} onChange={(e) => setDataPage(parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-slider"/><p className="text-xs text-center text-gray-400 mt-1">Page {dataPage + 1}</p></div>}</div>);
});
const KPICard = ({ title, value, prefix = '', suffix = ''}) => {
    return (<Panel className="text-center relative"><h3 className="text-sm text-gray-400 uppercase tracking-wider h-10">{title}</h3><p className="text-4xl font-bold text-[#14FFEC] mt-2">{prefix}{typeof value === 'number' ? value.toLocaleString(undefined, {maximumFractionDigits: 2}) : value}{suffix}</p></Panel>);
};
const GaugeChart = ({ title, value, max, ChartJS, description }) => { return <Panel/> };
const DashboardView = ({ dashboardName, setDashboardName, data, widgets, setWidgets, loading, ChartJS, activeDrilldown, onDrilldown, onResetDrilldown, onShowChartBuilder, onShowShare, onRemoveWidget, onOpenFilterModal, onSave, currentDashboardId, addToLog, isReadOnly, onNewDashboard, onShowHistory }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    const handleNameChange = (e) => {
        const oldName = dashboardName;
        const newName = e.target.value;
        setDashboardName(newName);
        addToLog('DASHBOARD_RENAME', { details: `Dashboard renamed from '${oldName}' to '${newName}'.` });
        setIsEditingName(false);
    };

    const calculateValue = (rec) => {
        let filteredData = data;
        if(rec.filter && rec.filter.values.length > 0) {
            const filterValues = new Set(rec.filter.values);
            filteredData = data.filter(row => filterValues.has(row[rec.filter.column]));
        }
        
        const { calculation, valueKey, value } = rec;
        if(calculation === 'value') return filteredData.length;
        if (!valueKey) return 'N/A';
        const values = (key) => filteredData.map(row => parseFloat(row[key])).filter(v => !isNaN(v));
        switch (calculation) {
            case 'sum': return values(valueKey).reduce((a, b) => a + b, 0);
            case 'average': const vals = values(valueKey); return vals.length > 0 ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
            case 'ratio': const num = values(valueKey[0]).reduce((a,b)=>a+b,0); const den = values(valueKey[1]).reduce((a,b)=>a+b,0); return den === 0 ? 0 : (num / den) * 100;
            case 'division': const n = values(valueKey[0]).reduce((a,b)=>a+b,0); const d = values(valueKey[1]).reduce((a,b)=>a+b,0); return d === 0 ? 0 : (n / d);
            default: return 'N/A';
        }
    };
    
    const handleDragStart = (e, index) => {
        if(isReadOnly) return;
        setDraggedItem(widgets[index]);
    }
    const handleDragOver = (e) => {
        if(isReadOnly) return;
        e.preventDefault();
    }
    const handleDrop = (e, targetIndex) => {
        if(isReadOnly) return;
        const newWidgets = [...widgets];
        const draggedIndex = widgets.findIndex(w => w.id === draggedItem.id);
        newWidgets.splice(draggedIndex, 1);
        newWidgets.splice(targetIndex, 0, draggedItem);
        setWidgets(newWidgets);
        setDraggedItem(null);
        addToLog('WIDGET_MOVE', { details: `Moved '${draggedItem.title}' to a new position.`});
    };
    
    if (loading) return <div className="flex items-center justify-center h-full"><div className="flex flex-col items-center justify-center space-y-4"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#14FFEC]"></div><p className="text-[#14FFEC] text-lg font-semibold">Generating AI Dashboard...</p></div></div>;
    
    return (
        <div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <div className="flex items-center gap-3">{isEditingName ? (<input type="text" defaultValue={dashboardName} onBlur={handleNameChange} onKeyDown={e => e.key === 'Enter' && handleNameChange(e)} className="text-3xl font-bold text-[#14FFEC] bg-transparent border-b-2 border-[#14FFEC] outline-none" autoFocus/>) : (<h2 className="text-3xl font-bold text-[#14FFEC]">{dashboardName}</h2>)}{!isReadOnly && <button onClick={() => setIsEditingName(!isEditingName)} className="text-gray-400 hover:text-white"><EditIcon className="h-6 w-6"/></button>}</div>
                <div className="flex gap-2 flex-wrap justify-end">
                    {!isReadOnly && (
                        <PrimaryButton onClick={onNewDashboard} className="flex items-center gap-2 bg-[#14FFEC] text-black hover:bg-[#0d7377]">
                            <NewDashboardIcon className="h-5 w-5" />
                            <span>New Dashboard</span>
                        </PrimaryButton>
                    )}
                    {onShowHistory && (
                        <button
                            onClick={onShowHistory}
                            className="p-2 bg-[#323232] rounded-md hover:bg-[#4a4a4a]"
                            title="Dashboard History"
                        >
                            <HistoryIcon className="h-6 w-6 text-white" />
                        </button>
                    )}
                    {!isReadOnly && <button onClick={onShowChartBuilder} className="p-2 bg-[#323232] rounded-md hover:bg-[#4a4a4a]" title="Chart Builder"><ChatIcon className="h-6 w-6 text-white"/></button>}
                    <button onClick={onShowShare} className="p-2 bg-[#323232] rounded-md hover:bg-[#4a4a4a]" title="Share Dashboard"><ShareIcon className="h-6 w-6 text-white"/></button>
                </div>
            </div>
            {activeDrilldown && <div className="mb-4"><PrimaryButton onClick={onResetDrilldown}>&larr; Back (Viewing {activeDrilldown.key}: {activeDrilldown.value})</PrimaryButton></div>}
            
            <div className="grid grid-cols-12 gap-6">
                 {widgets.map((rec, index) => {
                    if (rec.type === 'kpi') {
                        return (
                             <div 
                                key={rec.id} 
                                className={`col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 xl:col-span-2 ${!isReadOnly ? 'cursor-grab' : ''}`}
                                draggable={!isReadOnly}
                                onDragStart={(e) => handleDragStart(e, index)} 
                                onDragOver={handleDragOver} 
                                onDrop={(e) => handleDrop(e, index)}
                            >
                                <KPICard title={rec.title} value={calculateValue(rec)} prefix={rec.prefix} suffix={rec.suffix}/>
                            </div>
                        )
                    }
                    
                    const spanClass = rec.span === 'lg:col-span-2' ? 'col-span-12 lg:col-span-8' : 'col-span-12 lg:col-span-4';

                    return (
                        <div 
                            key={rec.id} 
                            className={`${spanClass} h-[30rem] ${!isReadOnly ? 'cursor-grab' : ''}`}
                            draggable={!isReadOnly}
                            onDragStart={(e) => handleDragStart(e, index)} 
                            onDragOver={handleDragOver} 
                            onDrop={(e) => handleDrop(e, index)}
                        >
                            <Panel className="h-full flex flex-col">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-lg font-bold text-white">{rec.title}</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => onOpenFilterModal(rec.id)} className="p-1 text-gray-400 hover:text-white"><FilterIcon className="h-5 w-5"/></button>
                                        {!isReadOnly && <button onClick={() => onRemoveWidget(rec.id, rec.title)} className="p-1 text-gray-400 hover:text-white"><TrashIcon className="h-5 w-5"/></button>}
                                    </div>
                                </div>
                                <div className="flex-grow">
                                    {rec.type === 'gauge' && <GaugeChart title={rec.title} value={calculateValue(rec)} max={rec.max} ChartJS={ChartJS} description={rec.description}/>}
                                    {rec.type === 'chart' && <ChartComponent config={rec} data={data} ChartJS={ChartJS} onDrilldown={onDrilldown} />}
                                </div>
                                <InsightBox text={rec.insight} />
                            </Panel>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};
const ChartBuilderModal = ({isOpen, onClose, qualityReport, data, ChartJS, onAddChart}) => {
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [generatedChart, setGeneratedChart] = useState(null);

    const handleColumnToggle = (columnName) => {
        setSelectedColumns(prev => 
            prev.includes(columnName) 
            ? prev.filter(c => c !== columnName) 
            : [...prev, columnName]
        );
        setGeneratedChart(null);
    };

    useEffect(() => {
        if (selectedColumns.length === 0) { setSuggestions([]); return; }
        const fetchSuggestions = async () => {
            setIsLoading(true);
            const selectedMetadata = selectedColumns.map(name => ({ name, ...qualityReport[name] }));
            const result = await getChartSuggestionsForColumns(selectedMetadata);
            setSuggestions(result);
            setIsLoading(false);
        };
        fetchSuggestions();
    }, [selectedColumns, qualityReport]);

    return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Chart Builder" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <h3 className="text-lg font-semibold text-white mb-2">1. Select Columns</h3>
                <p className="text-sm text-gray-400 mb-4">Choose 1 or 2 columns to visualize.</p>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">{Object.entries(qualityReport).map(([name, meta]) => (<label key={name} className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${selectedColumns.includes(name) ? 'bg-[#0D7377]' : 'bg-[#212121] hover:bg-[#2a2a2a]'}`}><input type="checkbox" checked={selectedColumns.includes(name)} onChange={() => handleColumnToggle(name)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#14FFEC] focus:ring-[#14FFEC]"/><span className="ml-3 text-white">{name}</span><span className="ml-auto text-xs text-gray-400 capitalize">{meta.type}</span></label>))}</div>
            </div>
            <div className="md:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-2">2. Choose a Chart</h3>
                 {isLoading && <div className="flex justify-center items-center h-full"><LoadingSpinner text="Getting recommendations..."/></div>}
                 {!isLoading && suggestions.length === 0 && (<div className="text-center py-10 text-gray-500"><p>{selectedColumns.length > 0 ? "No suitable chart for this combination. Try selecting 1 or 2 columns." : "Select columns to get recommendations."}</p></div>)}
                <div className="space-y-4">
                    {suggestions.map((sugg, i) => (
                        <div key={i} className="bg-[#212121] p-4 rounded-lg flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-[#14FFEC]">{sugg.chartType}</h4>
                                <p className="text-sm text-gray-300 mt-2" dangerouslySetInnerHTML={{ __html: sugg.explanation }} />
                            </div>
                            <PrimaryButton onClick={() => setGeneratedChart(sugg.config)}>Generate</PrimaryButton>
                        </div>
                    ))}
                </div>
                 {generatedChart && (
                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold text-white">Generated Chart</h3>
                            <PrimaryButton onClick={() => onAddChart(generatedChart)}>Add to Dashboard</PrimaryButton>
                        </div>
                        <div className="h-96 bg-[#323232] rounded-lg p-4">
                           <ChartComponent config={generatedChart} data={data} ChartJS={ChartJS} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    </Modal>
    );
};
const FilterModal = ({ widget, data, onClose, onApplyFilter }) => {
    const [selectedColumn, setSelectedColumn] = useState(widget?.filter?.column || widget?.x_axis || '');
    const [selectedValues, setSelectedValues] = useState(new Set(widget?.filter?.values || []));

    const filterableColumns = useMemo(() => {
        if (!data || data.length === 0) return [];
        return Object.keys(data[0]).filter(key => {
            const uniqueValues = new Set(data.map(row => row[key]));
            return uniqueValues.size > 1 && uniqueValues.size < 50; // Only show categorical-like columns
        });
    }, [data]);

    const columnValues = useMemo(() => {
        if (!selectedColumn || !data) return [];
        return [...new Set(data.map(row => row[selectedColumn]))].sort();
    }, [selectedColumn, data]);

    const handleValueToggle = (value) => {
        setSelectedValues(prev => {
            const newSet = new Set(prev);
            if (newSet.has(value)) {
                newSet.delete(value);
            } else {
                newSet.add(value);
            }
            return newSet;
        });
    };
    
    const handleApply = () => {
        onApplyFilter(widget.id, { column: selectedColumn, values: [...selectedValues] });
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`Filter: ${widget?.title}`} size="lg">
            <div className="space-y-4">
                <div>
                    <label className="text-gray-300 font-semibold mb-2 block">Filter by Column:</label>
                    <select value={selectedColumn} onChange={e => setSelectedColumn(e.target.value)} className="w-full p-2 bg-[#212121] border border-gray-600 rounded-lg text-white">
                        <option value="">-- Select a column --</option>
                        {filterableColumns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                </div>
                {selectedColumn && (
                    <div>
                        <h4 className="text-gray-300 font-semibold mb-2">Values:</h4>
                        <div className="max-h-60 overflow-y-auto bg-[#212121] p-3 rounded-lg space-y-2">
                            {columnValues.map(val => (
                                <label key={val} className="flex items-center gap-3 p-2 hover:bg-[#3a3a3a] rounded cursor-pointer">
                                    <input type="checkbox" checked={selectedValues.has(val)} onChange={() => handleValueToggle(val)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-[#14FFEC] focus:ring-[#14FFEC]"/>
                                    <span className="text-white">{val}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-6 flex justify-end gap-4">
                <button onClick={onClose} className="text-gray-400 font-bold py-2 px-6 rounded-lg hover:bg-[#4a4a4a]">Cancel</button>
                <PrimaryButton onClick={handleApply}>Apply Filter</PrimaryButton>
            </div>
        </Modal>
    );
};
const ShareModal = ({ isOpen, onClose, stateToShare }) => {
    const [shareCode, setShareCode] = useState('');
    const [copyButtonText, setCopyButtonText] = useState('Copy Code');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const cleanedData = stateToShare?.cleanedData || [];

    useEffect(() => {
        if (!isOpen) return;

        const createShareable = async () => {
            setIsLoading(true);
            setError('');
            try {
                const response = await dashboardApi.shareDashboard(cleanedData);
                const generatedCode = response.code || response?.share_code;
                setShareCode(generatedCode || '------');
            } catch (err) {
                console.error('Error creating shareable dashboard:', err);
                setError(err?.response?.data?.detail || 'Unable to generate share code.');
                setShareCode('');
            } finally {
                setIsLoading(false);
                setCopyButtonText('Copy Code');
            }
        };

        createShareable();
    }, [isOpen, cleanedData]);

    const handleCopy = () => {
        if (!shareCode || isLoading) return;
        try {
            const textarea = document.createElement("textarea");
            textarea.value = shareCode;
            textarea.style.position = "fixed";
            textarea.style.opacity = 0;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopyButtonText('Copied!');
            setTimeout(() => setCopyButtonText('Copy Code'), 2000);
        } catch (err) {
            console.error("Copy failed", err);
            setCopyButtonText('Failed to copy');
            setTimeout(() => setCopyButtonText('Copy Code'), 2000);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Dashboard">
            <p className="text-gray-300 mb-2">Copy and share this code with others.</p>
            <p className="text-xs text-gray-500 mb-4">They can use the "View Shared" option to load your dashboard.</p>
            <div className="w-full p-4 bg-[#212121] border border-gray-600 rounded-lg text-white mb-2 font-mono text-2xl tracking-widest text-center">
                {isLoading ? <LoadingSpinner text="Generating code..."/> : (shareCode || '------')}
            </div>
            {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
            <PrimaryButton onClick={handleCopy} className="w-full" disabled={isLoading || !shareCode}>{copyButtonText}</PrimaryButton>
        </Modal>
    );
};

const ViewSharedModal = ({ isOpen, onClose, onLoadShared }) => {
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLoad = async () => {
        const trimmedCode = code.trim().toUpperCase();
        if (!trimmedCode) return;

        setIsLoading(true);
        setError('');
        try {
            const shared = await dashboardApi.getSharedDashboard(trimmedCode);
            onLoadShared({
                cleanedData: shared.cleanedData || [],
                dashboardName: shared.dashboardName || `Shared Dashboard ${trimmedCode}`,
                dashboardWidgets: shared.dashboardWidgets || [],
            });
            onClose();
        } catch (err) {
            console.error("Error loading shared dashboard:", err);
            setError(err?.response?.data?.detail || 'Could not load the dashboard. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="View Shared Dashboard">
            <p className="text-gray-300 mb-4">Paste the 6-digit share code below to load a read-only dashboard.</p>
            <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABC123"
                maxLength="6"
                className="w-full p-4 bg-[#212121] border border-gray-600 rounded-lg text-white mb-2 font-mono text-2xl tracking-widest text-center uppercase"
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <PrimaryButton onClick={handleLoad} className="w-full" disabled={isLoading}>
                {isLoading ? <LoadingSpinner text="Loading..." /> : 'Load Dashboard'}
            </PrimaryButton>
        </Modal>
    );
};

const DashboardHistoryList = ({ dashboards, onLoad, onRename, onDelete, isCollapsed }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDashboards = useMemo(() => {
        if (!searchTerm) return dashboards;
        return dashboards.filter(d => 
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [dashboards, searchTerm]);


    const handleRenameStart = (dashboard) => {
        setEditingId(dashboard.id);
        setNewName(dashboard.name);
    };

    const handleRenameSubmit = () => {
        if(editingId && newName) {
            onRename(editingId, newName);
        }
        setEditingId(null);
        setNewName('');
    };

    return (
        <>
            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col flex-grow overflow-hidden">
                <div className={`px-1 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0' : 'opacity-100 h-auto'}`}>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dashboard History</h3>
                    <input 
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full p-1.5 bg-[#212121] border border-gray-600 rounded-md text-white text-xs mt-2"
                    />
                </div>
                 <h3 className={`text-xs font-semibold text-gray-400 uppercase tracking-wider text-center ${isCollapsed ? '' : 'hidden'}`}>DBs</h3>

                <div className="mt-2 space-y-1 flex-grow overflow-y-auto pr-1">
                    {filteredDashboards.map(d => (
                        <div key={d.id} title={isCollapsed ? d.name : ''} className="group flex items-center justify-between p-3 rounded-lg text-gray-300 hover:bg-[#4a4a4a]">
                            {editingId === d.id ? (
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onBlur={handleRenameSubmit}
                                    onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
                                    className="bg-transparent text-white w-full outline-none"
                                    autoFocus
                                />
                            ) : (
                                <button onClick={() => onLoad(d.id)} className={`flex-grow text-left truncate ${isCollapsed ? 'hidden' : ''}`}>{d.name}</button>
                            )}
                             {isCollapsed && <button onClick={() => onLoad(d.id)} className="w-full flex justify-center"><ChartIcon className="h-5 w-5"/></button>}

                            <div className={`flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity ${isCollapsed ? 'hidden' : ''}`}>
                                <button onClick={() => handleRenameStart(d)} className="p-1 hover:text-white"><EditIcon className="h-4 w-4" /></button>
                                <button onClick={() => setDeletingId(d.id)} className="p-1 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                        </div>
                    ))}
                    {dashboards.length === 0 && <p className={`p-3 text-sm text-gray-500 ${isCollapsed ? 'text-center' : ''}`}>{isCollapsed ? '...' : 'No saved dashboards.'}</p>}
                </div>
            </div>
            <ConfirmationModal 
                isOpen={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={() => onDelete(deletingId)}
                title="Delete Dashboard"
                message="Are you sure you want to delete this dashboard? This action cannot be undone."
            />
        </>
    )
}

const SettingsModal = ({ isOpen, onClose, onShowViewShared, onToggleActivity, onReset, onDeleteHistory, onLogout }) => {
    const [view, setView] = useState('main'); // 'main' | 'account'
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showDeleteHistoryConfirm, setShowDeleteHistoryConfirm] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const [animatingIcons, setAnimatingIcons] = useState({});

    const handleIconClick = (label, action) => {
        setAnimatingIcons(prev => ({ ...prev, [label]: true }));
        action();
        setTimeout(() => setAnimatingIcons(prev => ({ ...prev, [label]: false })), 700);
    }
    
    const userName = localStorage.getItem('user_name') || 'Vizora User';
    const userEmail = localStorage.getItem('user_email') || 'Authenticated session';
    
    const getAnimationClass = (label) => {
        switch(label) {
            case 'View Shared': return 'animate-eye-view';
            case 'Activity': return 'animate-clock-rotate';
            case 'New Dashboard': return 'animate-new-dashboard';
            case 'Logout': return 'animate-logout';
            default: return '';
        }
    }

    const mainSettings = [
        { icon: UserIcon, label: 'My Account', action: () => setView('account') },
        { icon: EyeIcon, label: 'View Shared', action: () => {onShowViewShared(); onClose();} },
        { icon: ActivityIcon, label: 'Activity', action: () => {onToggleActivity(); onClose();} },
        { icon: NewDashboardIcon, label: 'New Dashboard', action: () => {onReset(); onClose();} },
        { icon: LogoutIcon, label: 'Logout', action: () => setShowLogoutConfirm(true), color: 'text-red-400 hover:bg-red-500/20' },
    ];
    
    return (
        <>
            <Modal isOpen={isOpen} onClose={() => {onClose(); setView('main');}} title={view === 'main' ? "Settings" : "My Account"}
                className={`transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-5'}`}
            >
                {view === 'account' && <button onClick={() => setView('main')} className="absolute top-6 left-6 text-gray-400 hover:text-white"><ArrowLeftIcon className="h-6 w-6"/></button>}
                <div className="space-y-4 mt-4">
                     {view === 'main' && mainSettings.map(item => (
                        <button key={item.label} onClick={() => handleIconClick(item.label, item.action)} className={`w-full flex items-center p-3 rounded-lg text-lg transition-all duration-200 text-left transform active:scale-95 ${item.color || 'text-gray-300 hover:bg-[#4a4a4a]'}`}>
                            <item.icon className={`h-6 w-6 mr-3 ${animatingIcons[item.label] ? getAnimationClass(item.label) : ''}`}/>
                            <span>{item.label}</span>
                        </button>
                     ))}
                     {view === 'account' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-[#2a2a2a] rounded-lg text-center">
                                <p className="text-gray-300"><strong>Name:</strong> {userName}</p>
                                <p className="text-gray-300"><strong>Email:</strong> {userEmail}</p>
                            </div>
                             <PrimaryButton onClick={() => setShowChangePassword(true)} className="w-full">Change Password</PrimaryButton>
                             <button onClick={() => setShowDeleteHistoryConfirm(true)} className="w-full text-red-400 font-bold py-2 px-6 rounded-lg hover:bg-red-500/20 transition-all">Delete History</button>
                        </div>
                     )}
                </div>
            </Modal>
            
            <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
            
            <ConfirmationModal 
                isOpen={showDeleteHistoryConfirm}
                onClose={() => setShowDeleteHistoryConfirm(false)}
                onConfirm={async () => {
                    await onDeleteHistory?.();
                    setShowDeleteHistoryConfirm(false);
                    onClose();
                }}
                title="Delete All Dashboards?"
                message="This is a dangerous action. All your saved dashboards will be permanently deleted and you can't undo it."
            />
            <LogoutModal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onLogout={onLogout} />
        </>
    )
}

const ChangePasswordModal = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Change Password">
            <div className="space-y-4">
                <input type="password" placeholder="Old Password" className="w-full p-2 bg-[#212121] border border-gray-600 rounded-lg text-white" />
                <input type="password" placeholder="New Password" className="w-full p-2 bg-[#212121] border border-gray-600 rounded-lg text-white" />
                <input type="password" placeholder="Confirm New Password" className="w-full p-2 bg-[#212121] border border-gray-600 rounded-lg text-white" />
                <PrimaryButton className="w-full" onClick={() => {alert("Password change not implemented yet."); onClose();}}>Update Password</PrimaryButton>
            </div>
        </Modal>
    )
}

const LogoutModal = ({ isOpen, onClose, onLogout }) => {
    const handleLogout = () => {
        try {
            onLogout?.();
        } finally {
            onClose();
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Logout">
            <div className="text-center">
                <h3 className="text-xl text-white mb-2">We're sad to see you go!</h3>
                <p className="text-gray-400 mb-6">Thank you for using Vizora. We hope to see you again soon!</p>
                <PrimaryButton onClick={handleLogout} className="w-full">Confirm Logout</PrimaryButton>
            </div>
        </Modal>
    )
}

const DashboardHistoryScreen = ({ dashboards, onPreview, onDelete, onRename, onBack }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    const handleRenameStart = (dashboard) => {
        setEditingId(dashboard.id);
        setNewName(dashboard.name);
    };

    const handleRenameSubmit = () => {
        if(editingId && newName) {
            onRename(editingId, newName);
        }
        setEditingId(null);
        setNewName('');
    };

    return (
        <>
        <div className="p-8 min-h-screen">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 bg-[#323232] rounded-full hover:bg-[#4a4a4a]"><ArrowLeftIcon className="h-6 w-6 text-white"/></button>
                <h1 className="text-3xl font-bold text-white">Dashboard History</h1>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {dashboards.map(d => (
                     <div key={d.id} className="group bg-[#323232] rounded-lg p-4 flex flex-col justify-between">
                        {editingId === d.id ? (
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onBlur={handleRenameSubmit}
                                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()}
                                className="bg-[#2a2a2a] text-white w-full outline-none p-2 rounded-md mb-4"
                                autoFocus
                            />
                        ) : (
                            <h3 className="text-lg font-semibold text-white truncate mb-4">{d.name}</h3>
                        )}
                        <div className="flex items-center justify-between">
                            <PrimaryButton onClick={() => onPreview(d.id)}>Open</PrimaryButton>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleRenameStart(d)} className="p-2 text-gray-400 hover:text-white"><EditIcon className="h-5 w-5" /></button>
                                <button onClick={() => setDeletingId(d.id)} className="p-2 text-gray-400 hover:text-red-400"><TrashIcon className="h-5 w-5" /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {dashboards.length === 0 && <p className="text-center text-gray-500">You haven't saved any dashboards yet.</p>}
        </div>
        <ConfirmationModal 
            isOpen={!!deletingId}
            onClose={() => setDeletingId(null)}
            onConfirm={() => onDelete(deletingId)}
            title="Delete Dashboard"
            message="Are you sure you want to delete this dashboard? This action cannot be undone."
        />
        </>
    );
}

const Exports = ({ data, XLSX }) => { 
     const exportDataToCSV = () => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'cleaned_data.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    return (<div><h2 className="text-3xl font-bold text-[#14FFEC] mb-6">Exports</h2><Panel><h3 className="text-xl font-semibold text-white mb-4">Export Cleaned Data</h3><PrimaryButton onClick={exportDataToCSV}>Download as CSV</PrimaryButton></Panel></div>);
};
const ActivityPanel = ({ isOpen, onClose, log }) => {
    const renderLogDetails = (item) => {
        switch (item.type) {
            case 'DASHBOARD_RENAME': return <span>{item.details.details}</span>;
            case 'CHART_ADDED': return <span>Added chart: <strong>{item.details.title}</strong></span>;
            case 'CHART_REMOVED': return <span>Removed chart: <strong>{item.details.title}</strong></span>;
            case 'DATA_EDIT': return <span>{item.details.details}</span>;
            case 'AUTO_CLEAN': return <span><strong>{item.details.step}:</strong> {item.details.details}</span>;
            case 'MANUAL_CLEAN': return <span><strong>{item.details.action}:</strong> {item.details.details}</span>;
            case 'FILTER_APPLIED': return <span>{item.details.details}</span>
            default: return <span>{JSON.stringify(item.details)}</span>
        }
    };

    return (
        <div className={`fixed top-0 right-0 h-full w-96 bg-[#2a2a2a] shadow-2xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold text-[#14FFEC]">Activity Log</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto h-[calc(100%-60px)]">
                {log.length === 0 ? <p className="text-gray-500">No activity yet.</p> : (
                    <ul className="space-y-4">
                        {log.map((item, index) => (
                            <li key={index} className="text-sm border-l-2 border-gray-700 pl-3">
                                <p className="text-gray-300">{renderLogDetails(item)}</p>
                                <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleTimeString()}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.onload = resolve; script.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(script);
});

export default function App() {
    const [searchParams] = useSearchParams();
    const [appState, setAppState] = useState('upload');
    const [originalData, setOriginalData] = useState(null);
    const [cleanedData, setCleanedData] = useState(null);
    const [dashboardName, setDashboardName] = useState('My Dashboard');
    const [dashboardWidgets, setDashboardWidgets] = useState([]);
    const [currentDashboardId, setCurrentDashboardId] = useState(null);
    const [savedDashboards, setSavedDashboards] = useState([]);
    const [libraries, setLibraries] = useState(null);
    const [activityLog, setActivityLog] = useState([]);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [showViewSharedModal, setShowViewSharedModal] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isBackendLoading, setIsBackendLoading] = useState(false);
    const [backendLoadError, setBackendLoadError] = useState(null);
    const [isSavingDashboard, setIsSavingDashboard] = useState(false);
    const [historyReturnState, setHistoryReturnState] = useState('upload');
    
    const addToLog = useCallback((type, details) => {
        setActivityLog(prev => [{ timestamp: new Date(), type, details }, ...prev]);
    }, []);
    
    addToLog.log = activityLog;

    const fetchSavedDashboards = useCallback(async () => {
        try {
            const dashboards = await dashboardApi.getMyDashboards();
            const mapped = dashboards
                .filter(d => d.is_active !== 0)
                .map(d => ({
                    id: d.id,
                    name: d.dashboard_name,
                    data: d.dashboard_json || [],
                    createdAt: d.created_at,
                }));
            setSavedDashboards(mapped);
        } catch (error) {
            console.error('Failed to load dashboards:', error);
        }
    }, []);

    useEffect(() => {
        fetchSavedDashboards();
    }, [fetchSavedDashboards]);


    const loadLibs = useCallback(async () => {
        if(libraries) return;
        try {
            const xlsxModule = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
            await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js');
            setLibraries({ XLSX: xlsxModule, ChartJS: window.Chart });
        } catch (error) { console.error("Failed to load libraries:", error); }
    }, [libraries]);

    useEffect(() => { loadLibs(); }, [loadLibs]);

    const queryDashboardId = searchParams.get('id');

    useEffect(() => {
        if (!queryDashboardId) {
            setBackendLoadError(null);
            return;
        }

        const loadDashboardFromApi = async () => {
            setIsBackendLoading(true);
            setBackendLoadError(null);
            try {
                const response = await dashboardApi.getDashboard(queryDashboardId);
                setIsReadOnly(true);
                setOriginalData(response.dashboard_json || []);
                setCleanedData(response.dashboard_json || []);
                setDashboardName(response.dashboard_name || 'Dashboard');
                setDashboardWidgets([]);
                setCurrentDashboardId(response.id);
                setAppState('dashboard');
                addToLog('BACKEND_LOAD', { details: `Loaded dashboard #${response.id}` });
            } catch (error) {
                console.error('Failed to load dashboard', error);
                setBackendLoadError(error?.response?.data?.detail || 'Failed to load dashboard');
            } finally {
                setIsBackendLoading(false);
            }
        };

        loadDashboardFromApi();
    }, [queryDashboardId, addToLog]);

    const handleFileProcessed = (data, fileName) => {
        if (data.length > 0) {
            const newName = fileName.replace(/_/g, ' ').replace(/\.[^/.]+$/, "");
            setOriginalData(data);
            setCleanedData(data);
            setDashboardName(newName);
            setDashboardWidgets([]);
            setCurrentDashboardId(null);
            setAppState('mode_selection');
            addToLog('FILE_UPLOAD', { details: `Processed file: ${fileName}` });
        } else { alert("Uploaded file is empty."); }
    };
    
    const handleCleaningComplete = (finalData) => {
        setCleanedData(finalData);
        setAppState('dashboard');
    };

    const handleReset = () => {
        setAppState('upload');
        setOriginalData(null);
        setCleanedData(null);
        setDashboardName('My Dashboard');
        setDashboardWidgets([]);
        setCurrentDashboardId(null);
        setIsReadOnly(false);
        setActivityLog([]);
        setBackendLoadError(null);
    };

    const handleLoadShared = (sharedState) => {
        if (sharedState.cleanedData && sharedState.dashboardName) {
            setOriginalData(sharedState.cleanedData);
            setCleanedData(sharedState.cleanedData);
            setDashboardName(`Copy of: ${sharedState.dashboardName}`);
            setDashboardWidgets(sharedState.dashboardWidgets || []);
            setCurrentDashboardId(null); // This is key to trigger a new save
            setIsReadOnly(false); // Make it the user's own copy
            setActivityLog([]);
            setAppState('dashboard'); // This will trigger the auto-save useEffect
        }
    };

    const handleShowHistory = useCallback(() => {
        setHistoryReturnState(appState);
        setAppState('history');
    }, [appState]);

    const handleHistoryBack = useCallback(() => {
        setAppState(historyReturnState || 'upload');
    }, [historyReturnState]);


    const handleSaveDashboard = useCallback(async () => {
        if (isReadOnly || !cleanedData || cleanedData.length === 0 || isSavingDashboard) return;
        setIsSavingDashboard(true);
        try {
            if (currentDashboardId) {
                await dashboardApi.updateDashboard(currentDashboardId, cleanedData, dashboardName);
                addToLog('DASHBOARD_SAVE', { details: `Updated dashboard '${dashboardName}'.` });
            } else {
                const response = await dashboardApi.createDashboard({
                    dashboard_json: cleanedData,
                    dashboard_name: dashboardName,
                });
                setCurrentDashboardId(response.id);
                addToLog('DASHBOARD_SAVE', { details: `Saved new dashboard '${dashboardName}'.` });
            }
            await fetchSavedDashboards();
        } catch (error) {
            console.error('Error saving dashboard:', error);
        } finally {
            setIsSavingDashboard(false);
        }
    }, [isReadOnly, cleanedData, isSavingDashboard, currentDashboardId, dashboardName, fetchSavedDashboards, addToLog]);

    useEffect(() => {
        if (appState === 'dashboard' && !currentDashboardId && !isReadOnly && cleanedData && cleanedData.length > 0 && !isSavingDashboard) {
            handleSaveDashboard();
        }
    }, [appState, currentDashboardId, isReadOnly, cleanedData, handleSaveDashboard, isSavingDashboard]);
    
    const handleLoadDashboard = async (dashboardId) => {
        if (!dashboardId) return;
        setIsLoadingData(true);
        try {
            const response = await dashboardApi.getDashboard(dashboardId);
            const data = response.dashboard_json || [];
            setCurrentDashboardId(response.id);
            setDashboardName(response.dashboard_name);
            setCleanedData(data);
            setOriginalData(data);
            setDashboardWidgets([]);
            setAppState('dashboard');
            setIsReadOnly(false);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setIsLoadingData(false);
        }
    };
    
    const handleRenameDashboard = async (dashboardId, newName) => {
        if (!dashboardId || !newName) return;
        const dashboard = savedDashboards.find(d => d.id === dashboardId);
        if (!dashboard) return;
        try {
            await dashboardApi.updateDashboard(dashboardId, dashboard.data, newName);
            if (currentDashboardId === dashboardId) {
                setDashboardName(newName);
            }
            await fetchSavedDashboards();
        } catch (error) {
            console.error('Failed to rename dashboard:', error);
        }
    };

    const handleDeleteDashboard = async (dashboardId) => {
        if (!dashboardId) return;
        try {
            await dashboardApi.deleteDashboard(dashboardId);
            if(currentDashboardId === dashboardId) {
                handleReset();
            }
            await fetchSavedDashboards();
        } catch (error) {
            console.error('Failed to delete dashboard:', error);
        }
    };

    const handleDeleteHistory = async () => {
        try {
            await Promise.all(savedDashboards.map(d => dashboardApi.deleteDashboard(d.id)));
            handleReset();
            await fetchSavedDashboards();
        } catch (error) {
            console.error('Failed to delete dashboard history:', error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    const renderAppState = () => {
        const libsReady = !!libraries;
        if (!libsReady || isLoadingData || isBackendLoading) {
            const message = isBackendLoading
                ? 'Loading Dashboard...'
                : isLoadingData
                    ? 'Loading Dashboard Data...'
                    : !libsReady
                        ? 'Loading Libraries...'
                        : 'Connecting...';
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#14FFEC]"></div>
                        <p className="text-[#14FFEC] text-lg font-semibold">{message}</p>
                    </div>
                </div>
            );
        }

        if (backendLoadError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <Panel className="max-w-lg text-center space-y-4">
                        <InfoIcon className="h-12 w-12 text-red-400 mx-auto" />
                        <h2 className="text-2xl font-bold">Unable to load dashboard</h2>
                        <p className="text-gray-300">{backendLoadError}</p>
                        <PrimaryButton onClick={() => { setAppState('upload'); setIsReadOnly(false); }}>Return to Upload</PrimaryButton>
                    </Panel>
                </div>
            );
        }
        
           if (isReadOnly) {
               return <Dashboard dashboardName={dashboardName} setDashboardName={setDashboardName} cleanedData={cleanedData} setCleanedData={setCleanedData} dashboardWidgets={dashboardWidgets} setDashboardWidgets={setDashboardWidgets} onReset={handleReset} onSave={() => {}} libraries={libraries} addToLog={addToLog} isReadOnly={true} onLoadShared={handleLoadShared} onShowViewShared={() => setShowViewSharedModal(true)} savedDashboards={[]} onLoadDashboard={()=>{}} onRenameDashboard={()=>{}} onDeleteDashboard={()=>{}} onDeleteHistory={handleDeleteHistory} onLogout={handleLogout} onShowHistory={handleShowHistory} />;
           }
        
        switch (appState) {
            case 'upload': return <FileUploadScreen onFileProcessed={handleFileProcessed} XLSX={libraries?.XLSX} onShowViewShared={() => setShowViewSharedModal(true)} onShowHistory={handleShowHistory} />;
            case 'history': return <DashboardHistoryScreen dashboards={savedDashboards} onPreview={handleLoadDashboard} onDelete={handleDeleteDashboard} onRename={handleRenameDashboard} onBack={handleHistoryBack} />;
            case 'mode_selection': return (<div className="relative min-h-screen"><button onClick={handleShowHistory} className="absolute top-6 right-6 p-3 bg-[#323232] rounded-full hover:bg-[#4a4a4a] transition-colors" title="View Dashboard History"><HistoryIcon className="h-6 w-6 text-white"/></button><div className="flex flex-col items-center justify-center min-h-screen p-4"><h1 className="text-4xl font-bold text-white mb-6">Choose Cleaning Mode</h1><Panel className="w-full max-w-md space-y-6"><div><h2 className="text-2xl font-semibold text-[#14FFEC]">Auto Mode</h2><p className="text-gray-300 mt-2">Let Vizora automatically clean your data. Ideal for quick results and best practices.</p><PrimaryButton onClick={() => setAppState('auto_progress')} className="mt-4 w-full">Start Auto Cleaning</PrimaryButton></div><div className="border-t border-gray-600"></div><div><h2 className="text-2xl font-semibold text-[#14FFEC]">Manual Mode</h2><p className="text-gray-300 mt-2">A step-by-step wizard for full control over the cleaning process.</p><PrimaryButton onClick={() => setAppState('manual_wizard')} className="mt-4 w-full">Start Manual Wizard</PrimaryButton></div></Panel></div></div>);
            case 'auto_progress': return <AutoCleaningProgress data={originalData} onCleaningComplete={handleCleaningComplete} addToLog={addToLog} />;
            case 'manual_wizard': return <ManualCleaningWizard originalData={originalData} onCleaningComplete={handleCleaningComplete} addToLog={addToLog} />;
            case 'dashboard': return <Dashboard currentDashboardId={currentDashboardId} dashboardName={dashboardName} setDashboardName={setDashboardName} cleanedData={cleanedData} setCleanedData={setCleanedData} dashboardWidgets={dashboardWidgets} setDashboardWidgets={setDashboardWidgets} onReset={handleReset} onSave={handleSaveDashboard} libraries={libraries} addToLog={addToLog} isReadOnly={false} onLoadShared={handleLoadShared} onShowViewShared={() => setShowViewSharedModal(true)} savedDashboards={savedDashboards} onLoadDashboard={handleLoadDashboard} onRenameDashboard={handleRenameDashboard} onDeleteDashboard={handleDeleteDashboard} onDeleteHistory={handleDeleteHistory} onLogout={handleLogout} onShowHistory={handleShowHistory} />;
            default: return <FileUploadScreen onFileProcessed={handleFileProcessed} XLSX={libraries?.XLSX} />;
        }
    };

    return (
        <div className="bg-[#212121] text-white min-h-screen font-sans">
            <style>{`
                    @keyframes gear-rotate { from { transform: rotate(0deg); } to { transform: rotate(180deg); } }
                    .animate-gear-rotate { animation: gear-rotate 0.5s ease-in-out; }
                    
                    @keyframes clock-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    .animate-clock-rotate { animation: clock-rotate 0.7s ease-in-out; }

                    @keyframes eye-view-animation { 
                        0% { transform: scaleY(1); } 
                        20% { transform: scaleY(0.1); }
                        40% { transform: scaleY(1); }
                        60% { stroke-dashoffset: 25.5; }
                        100% { stroke-dashoffset: 0; }
                    }
                    .animate-eye-view .eye-parts { animation: eye-view-animation 0.7s ease-in-out; }
                    .animate-eye-view .eye-slash { animation: eye-view-animation 0.7s ease-in-out; }

                    @keyframes new-dashboard-animate {
                        0%, 100% { transform: scale(1); }
                        30% { transform: scale(1.05); }
                        40%, 60% { transform: rotate(-2deg) scale(1.05); }
                        50%, 70% { transform: rotate(2deg) scale(1.05); }
                        80% { transform: rotate(0deg) scale(1.05); }
                    }
                    .animate-new-dashboard { animation: new-dashboard-animate 0.7s cubic-bezier(.36,-0.64,.34,1.76); }
                    
                    @keyframes logout-animate {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(5px); }
                    }
                    .animate-logout .logout-arrow { animation: logout-animate 0.4s ease-in forwards; }
                    .animate-logout .logout-door { opacity: 0; transition: opacity 0.2s 0.2s; }

                    .range-slider::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:16px; height:16px; background:#14FFEC; cursor:pointer; border-radius:50%; margin-top:-6px; } 
                    .range-slider::-moz-range-thumb{ width:16px; height:16px; background:#14FFEC; cursor:pointer; border-radius:50%; } 
            `}</style>
            {renderAppState()}
            <ViewSharedModal 
                isOpen={showViewSharedModal} 
                onClose={() => setShowViewSharedModal(false)} 
                onLoadShared={handleLoadShared}
            />
        </div>
    );
}