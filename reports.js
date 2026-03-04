/* ========================================
   Reports Module - Analytics & Export
   ======================================== */

const Reports = {

    /**
     * Calculate category-wise breakdown
     */
    getCategoryBreakdown(trip) {
        const categories = {
            fuel: 0,
            meals: 0,
            accommodation: 0,
            transport: 0,
            activities: 0
        };

        // Fuel costs
        if (trip.vehicle && trip.vehicle.fuelPurchases) {
            categories.fuel = trip.vehicle.fuelPurchases.reduce((sum, purchase) =>
                sum + (purchase.totalCost || 0), 0
            );
        }

        // Day-wise expenses
        if (trip.days) {
            trip.days.forEach(day => {
                // Meals
                if (day.meals) {
                    categories.meals += day.meals.reduce((sum, meal) =>
                        sum + (meal.actualCost || meal.expectedCost || 0), 0
                    );
                }

                // Accommodation
                if (day.accommodation) {
                    categories.accommodation += day.accommodation.actualCost || day.accommodation.expectedCost || 0;
                }

                // Transport
                if (day.transport && Array.isArray(day.transport)) {
                    categories.transport += day.transport.reduce((sum, t) =>
                        sum + (t.actualCost || t.expectedCost || 0), 0
                    );
                }

                // Activities
                if (day.activities) {
                    categories.activities += day.activities.reduce((sum, activity) =>
                        sum + (activity.actualCost || activity.expectedCost || 0), 0
                    );
                }
            });
        }

        return categories;
    },

    /**
     * Calculate day-wise spending
     */
    getDayWiseSpending(trip) {
        if (!trip.days) return [];

        return trip.days.map(day => {
            let expected = 0;
            let actual = 0;

            // Meals
            if (day.meals) {
                day.meals.forEach(meal => {
                    expected += meal.expectedCost || 0;
                    actual += meal.actualCost || 0;
                });
            }

            // Accommodation
            if (day.accommodation) {
                expected += day.accommodation.expectedCost || 0;
                actual += day.accommodation.actualCost || 0;
            }

            // Transport
            if (day.transport && Array.isArray(day.transport)) {
                day.transport.forEach(t => {
                    expected += t.expectedCost || 0;
                    actual += t.actualCost || 0;
                });
            }

            // Activities
            if (day.activities) {
                day.activities.forEach(activity => {
                    expected += activity.expectedCost || 0;
                    actual += activity.actualCost || 0;
                });
            }

            return {
                day: day.dayNumber,
                date: day.date,
                expected,
                actual
            };
        });
    },

    /**
     * Calculate per-person expenses
     */
    getPerPersonExpenses(trip) {
        if (!trip.travelers || trip.travelers.length === 0) {
            return [];
        }

        const expenses = trip.travelers.map(traveler => ({
            id: traveler.id,
            name: traveler.name,
            paid: 0,
            share: 0,
            balance: 0
        }));

        const totalExpenses = UIComponents.calculateTotalActual(trip);

        // Calculate share based on split mode
        if (trip.splitMode === 'equal') {
            const sharePerPerson = totalExpenses / trip.travelers.length;
            expenses.forEach(exp => exp.share = sharePerPerson);
        } else if (trip.splitMode === 'custom') {
            expenses.forEach((exp, index) => {
                const percentage = trip.travelers[index].splitPercentage || 0;
                exp.share = (totalExpenses * percentage) / 100;
            });
        }

        // Calculate who paid what (simplified - would need to track paidBy in actual implementation)
        // For now, assume equal payment
        const paidPerPerson = totalExpenses / trip.travelers.length;
        expenses.forEach(exp => {
            exp.paid = paidPerPerson;
            exp.balance = exp.paid - exp.share;
        });

        return expenses;
    },

    /**
     * Get settlement summary (who owes whom)
     */
    getSettlements(trip) {
        const perPerson = this.getPerPersonExpenses(trip);
        const settlements = [];

        const creditors = perPerson.filter(p => p.balance > 0).sort((a, b) => b.balance - a.balance);
        const debtors = perPerson.filter(p => p.balance < 0).sort((a, b) => a.balance - b.balance);

        let i = 0, j = 0;
        while (i < creditors.length && j < debtors.length) {
            const amount = Math.min(creditors[i].balance, Math.abs(debtors[j].balance));

            if (amount > 0.01) { // Avoid tiny amounts due to floating point
                settlements.push({
                    from: debtors[j].name,
                    to: creditors[i].name,
                    amount: amount
                });
            }

            creditors[i].balance -= amount;
            debtors[j].balance += amount;

            if (Math.abs(creditors[i].balance) < 0.01) i++;
            if (Math.abs(debtors[j].balance) < 0.01) j++;
        }

        return settlements;
    },

    /**
     * Export trip data as JSON
     */
    exportJSON(trip) {
        const dataStr = JSON.stringify(trip, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${(trip.tripName || trip.name).replace(/\s+/g, '_')}_trip_data.json`;
        link.click();

        URL.revokeObjectURL(url);
        UIComponents.showToast('Trip data exported!', 'success');
    },

    /**
     * Export trip as CSV
     */
    exportCSV(trip) {
        let csv = 'Category,Item,Expected,Actual,Variance\n';

        // Fuel
        if (trip.vehicle && trip.vehicle.fuelPurchases) {
            trip.vehicle.fuelPurchases.forEach(purchase => {
                csv += `Fuel,${purchase.location || 'Fuel Purchase'},0,${purchase.totalCost},${purchase.totalCost}\n`;
            });
        }

        // Days
        if (trip.days) {
            trip.days.forEach(day => {
                // Meals
                if (day.meals) {
                    day.meals.forEach(meal => {
                        const variance = (meal.actualCost || 0) - (meal.expectedCost || 0);
                        csv += `Meal,${meal.type} - ${meal.venue || 'N/A'},${meal.expectedCost || 0},${meal.actualCost || 0},${variance}\n`;
                    });
                }

                // Activities
                if (day.activities) {
                    day.activities.forEach(activity => {
                        const variance = (activity.actualCost || 0) - (activity.expectedCost || 0);
                        csv += `Activity,${activity.name},${activity.expectedCost || 0},${activity.actualCost || 0},${variance}\n`;
                    });
                }
            });
        }

        const dataBlob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${(trip.tripName || trip.name).replace(/\s+/g, '_')}_expenses.csv`;
        link.click();

        URL.revokeObjectURL(url);
        UIComponents.showToast('Expense report exported!', 'success');
    }
};
