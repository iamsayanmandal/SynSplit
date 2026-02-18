import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import type { Expense, Member, ExpenseCategory } from '../types';
import { CATEGORY_META } from '../types';

export const exportGroupExpenses = (
    groupName: string,
    expenses: Expense[],
    members: Member[],
    filterLabel: string = 'All Time'
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // ─── Header Background ───
    doc.setFillColor(99, 102, 241); // Indigo-500 (#6366f1)
    doc.rect(0, 0, pageWidth, 50, 'F'); // Increased height for more info

    // ─── Header Content ───
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Expense Report', 14, 20);

    // Group Name
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(groupName, 14, 30);

    // Period / Filter Label
    doc.setFontSize(12);
    doc.setTextColor(224, 231, 255); // Indigo-100
    doc.text(`Period: ${filterLabel}`, 14, 40);

    // Generated Date (Top Right)
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    const dateText = `Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`;
    const dateTextWidth = doc.getTextWidth(dateText);
    doc.text(dateText, pageWidth - 14 - dateTextWidth, 20);

    // ─── Group Members Summary ───
    const membersText = `Members: ${members.map(m => m.name.split(' ')[0]).join(', ')}`;
    doc.setFontSize(10);
    doc.setTextColor(224, 231, 255);
    const membersTextWidth = doc.getTextWidth(membersText);
    // Right aligned, below date
    doc.text(membersText, pageWidth - 14 - membersTextWidth, 30);


    // ─── Summary Section (Below Header) ───
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Summary Box
    doc.setFillColor(243, 244, 246); // Gray-100
    doc.setDrawColor(229, 231, 235); // Gray-200
    doc.roundedRect(14, 55, pageWidth - 28, 25, 3, 3, 'FD');

    // Total Amount
    doc.setTextColor(17, 24, 39); // Gray-900
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total Expenses', 20, 65);

    doc.setTextColor(99, 102, 241); // Indigo-500
    doc.setFontSize(18);
    // Fix: Use 'Rs.' prefix instead of symbol to avoid encoding issues
    doc.text(`Rs. ${totalAmount.toLocaleString('en-IN')}`, 20, 75);

    // Transaction Count
    doc.setTextColor(107, 114, 128); // Gray-500
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${expenses.length} Transactions`, 100, 72); // Offset position


    // ─── Table ───
    const tableColumn = ["Date", "Description", "Category", "Paid By", "Amount"];
    const tableRows: string[][] = [];

    expenses.forEach(expense => {
        const date = format(new Date(expense.createdAt), 'dd MMM yyyy');
        const category = CATEGORY_META[expense.category as ExpenseCategory]?.label || expense.category;

        let payerName = 'Unknown';
        if (expense.paidBy === 'pool') {
            payerName = 'Pool';
        } else {
            const member = members.find(m => m.uid === expense.paidBy);
            payerName = member ? member.name.split(' ')[0] : 'Unknown';
        }

        const amount = `Rs. ${expense.amount.toLocaleString('en-IN')}`;

        tableRows.push([date, expense.description, category, payerName, amount]);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 90,
        theme: 'grid',
        headStyles: {
            fillColor: [99, 102, 241], // Indigo-500
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 4
        },
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 4,
            valign: 'middle',
            overflow: 'linebreak',
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            textColor: [55, 65, 81] // Gray-700
        },
        columnStyles: {
            0: { cellWidth: 30 }, // Date
            1: { cellWidth: 'auto' }, // Description
            2: { cellWidth: 30 }, // Category
            3: { cellWidth: 30 }, // Paid By
            4: { cellWidth: 35, halign: 'right', fontStyle: 'bold', textColor: [17, 24, 39] }, // Amount
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251] // Gray-50
        },
        foot: [[
            'Total', '', '', '',
            `Rs. ${totalAmount.toLocaleString('en-IN')}`
        ]],
        footStyles: {
            fillColor: [243, 244, 246], // Gray-100
            textColor: [17, 24, 39], // Gray-900
            fontStyle: 'bold',
            halign: 'right',
            cellPadding: 4
        },
        margin: { top: 90 }
    });

    // ─── Footer ───
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(156, 163, 175); // Gray-400

        const footerText = 'Generated by SynSplit';
        const linkText = 'synsplit.sayanmandal.in';
        const footerY = pageHeight - 10;

        // Centered Footer
        const textWidth = doc.getTextWidth(`${footerText} • ${linkText}`);
        const xConf = (pageWidth - textWidth) / 2;

        doc.text(footerText, xConf, footerY);
        doc.setTextColor(99, 102, 241); // Indigo-500
        const linkX = xConf + doc.getTextWidth(footerText) + 3;
        doc.text('• ' + linkText, linkX, footerY);
        doc.link(linkX + 3, footerY - 3, doc.getTextWidth(linkText), 10, { url: 'https://synsplit.sayanmandal.in' });
    }

    // Save PDF
    const safeGroupName = groupName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeLabel = filterLabel.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    doc.save(`synsplit_report_${safeGroupName}_${safeLabel}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
