/* ========================================
   Smart Trip Planner - Charts Module
   Pure CSS/SVG charts without external dependencies
   ======================================== */

const Charts = {

    /**
     * Create a pie chart for category breakdown
     */
    createPieChart(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const total = data.reduce((sum, item) => sum + item.value, 0);
        if (total === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">No data to display</p>';
            return;
        }

        let currentAngle = 0;
        const colors = [
            'var(--color-primary)',
            'var(--color-secondary)',
            'var(--color-accent)',
            'var(--color-success)',
            'var(--color-info)',
            'var(--color-warning)'
        ];

        const slices = data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const angle = (item.value / total) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;

            return {
                ...item,
                percentage,
                startAngle,
                endAngle: currentAngle,
                color: colors[index % colors.length]
            };
        });

        // Create SVG pie chart
        let svg = `
            <svg viewBox="0 0 200 200" style="max-width: 300px; margin: 0 auto; display: block;">
                <g transform="translate(100, 100)">
        `;

        slices.forEach(slice => {
            const startRad = (slice.startAngle - 90) * Math.PI / 180;
            const endRad = (slice.endAngle - 90) * Math.PI / 180;
            const x1 = 80 * Math.cos(startRad);
            const y1 = 80 * Math.sin(startRad);
            const x2 = 80 * Math.cos(endRad);
            const y2 = 80 * Math.sin(endRad);
            const largeArc = slice.percentage > 50 ? 1 : 0;

            svg += `
                <path d="M 0 0 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z"
                      fill="${slice.color}" opacity="0.9" stroke="white" stroke-width="2"/>
            `;
        });

        svg += `</g></svg>`;

        // Create legend
        let legend = '<div style="margin-top: 1rem;">';
        slices.forEach(slice => {
            legend += `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="width: 16px; height: 16px; background: ${slice.color}; border-radius: 4px;"></div>
                        <span>${slice.label}</span>
                    </div>
                    <span style="font-weight: 600;">${slice.percentage.toFixed(1)}%</span>
                </div>
            `;
        });
        legend += '</div>';

        container.innerHTML = svg + legend;
    },

    /**
     * Create a bar chart for comparisons
     */
    createBarChart(data, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const maxValue = Math.max(...data.map(item => Math.max(item.expected || 0, item.actual || 0)));
        if (maxValue === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">No data to display</p>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 1rem;">';

        data.forEach(item => {
            const expectedWidth = (item.expected / maxValue) * 100;
            const actualWidth = (item.actual / maxValue) * 100;

            html += `
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">${item.label}</div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <div style="flex: 1;">
                            <div style="background: var(--color-bg-secondary); border-radius: 4px; height: 32px; position: relative; overflow: hidden;">
                                <div style="background: var(--color-primary); height: 100%; width: ${expectedWidth}%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding: 0 0.5rem;">
                                    ${item.expected > 0 ? `<span style="font-size: 0.75rem; color: white; font-weight: 600;">${UIComponents.formatCurrency(item.expected)}</span>` : ''}
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Expected</div>
                        </div>
                        <div style="flex: 1;">
                            <div style="background: var(--color-bg-secondary); border-radius: 4px; height: 32px; position: relative; overflow: hidden;">
                                <div style="background: var(--color-secondary); height: 100%; width: ${actualWidth}%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding: 0 0.5rem;">
                                    ${item.actual > 0 ? `<span style="font-size: 0.75rem; color: white; font-weight: 600;">${UIComponents.formatCurrency(item.actual)}</span>` : ''}
                                </div>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--color-text-secondary); margin-top: 0.25rem;">Actual</div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }
};
