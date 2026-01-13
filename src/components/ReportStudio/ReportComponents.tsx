import React from 'react';
import { format } from 'date-fns';

export const Header: React.FC<{ url: string; height: number }> = ({ url, height }) => (
    <div
        className="absolute top-0 left-0 w-full overflow-hidden"
        style={{ height: `${height}mm` }}
    >
        <img src={url} alt="Header" className="w-full h-full object-cover" />
    </div>
);

export const Footer: React.FC<{ url: string; height: number }> = ({ url, height }) => (
    <div
        className="absolute bottom-0 left-0 w-full overflow-hidden"
        style={{ height: `${height}mm` }}
    >
        <img src={url} alt="Footer" className="w-full h-full object-cover" />
    </div>
);

export const PatientInfo: React.FC<{ order: any; patient: any }> = ({ order, patient }) => {
    return (
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm border-b pb-4">
            <div>
                <div className="flex mb-1">
                    <span className="w-24 font-semibold text-gray-600">Patient Name:</span>
                    <span className="font-bold uppercase">{patient?.name}</span>
                </div>
                <div className="flex mb-1">
                    <span className="w-24 font-semibold text-gray-600">Age / Sex:</span>
                    <span>{patient?.age || order?.age} / {patient?.gender || order?.gender}</span>
                </div>
                <div className="flex mb-1">
                    <span className="w-24 font-semibold text-gray-600">Patient ID:</span>
                    <span>{patient?.custom_id || patient?.id?.slice(0, 8)}</span>
                </div>
            </div>
            <div>
                <div className="flex mb-1">
                    <span className="w-24 font-semibold text-gray-600">Registered:</span>
                    <span>{order?.order_date ? format(new Date(order.order_date), 'dd/MM/yyyy h:mm a') : '-'}</span>
                </div>
                <div className="flex mb-1">
                    <span className="w-24 font-semibold text-gray-600">Referred By:</span>
                    <span>{order?.doctor?.name || order?.doctor_name || 'Self'}</span>
                </div>
                <div className="flex mb-1">
                    <span className="w-24 font-semibold text-gray-600">Order ID:</span>
                    <span>{order?.id?.slice(0, 8)}</span>
                </div>
            </div>
        </div>
    );
};

export const TestResultsTable: React.FC<{ tests: any[]; showColors: boolean }> = ({ tests, showColors }) => {
    // Group tests by Category or Profile if needed
    // For now, simple flat list or grouped by test_group

    // Basic rendering
    return (
        <div className="w-full">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b-2 border-gray-800">
                        <th className="text-left py-2 font-bold w-1/3">Investigation</th>
                        <th className="text-left py-2 font-bold w-1/6">Result</th>
                        <th className="text-left py-2 font-bold w-1/4">Ref. Range</th>
                        <th className="text-left py-2 font-bold w-1/6">Unit</th>
                    </tr>
                </thead>
                <tbody>
                    {tests.map((test, idx) => (
                        <React.Fragment key={test.id || idx}>
                            {/* Test Group Header if needed */}
                            {/* Parameters */}
                            {test.results && test.results.map((result: any, rIdx: number) => {
                                const isAbnormal = result.is_abnormal || (result.flag && result.flag !== 'normal');
                                const colorClass = showColors && isAbnormal ? 'text-red-600 font-bold' : 'text-gray-900';

                                return (
                                    <tr key={rIdx} className="border-b border-gray-100">
                                        <td className="py-2 pl-2">{result.parameter_name}</td>
                                        <td className={`py-2 ${colorClass}`}>{result.result_value}</td>
                                        <td className="py-2 text-gray-500 text-xs">{result.reference_range}</td>
                                        <td className="py-2 text-gray-500 text-xs">{result.unit}</td>
                                    </tr>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
