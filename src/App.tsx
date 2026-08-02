import React, { useState, useEffect } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  FileText, 
  Plus, 
  Building2, 
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { Employee, LeaveRecord } from './types';
import { INITIAL_EMPLOYEES, INITIAL_LEAVE_RECORDS, SAMPLE_DEMO_EMPLOYEES, SAMPLE_DEMO_LEAVE_RECORDS } from './utils/vacationCalc';
import { DashboardOverview } from './components/DashboardOverview';
import { EmployeeManager } from './components/EmployeeManager';
import { LedgerHistory } from './components/LedgerHistory';
import { LeaveLedgerModal } from './components/LeaveLedgerModal';
import { AuditLogsManager } from './components/AuditLogsManager';
import { registerDeviceConnection, addActivityLog } from './utils/auditLogger';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'ledger' | 'audit'>('dashboard');
  
  // Register Device on Mount
  useEffect(() => {
    registerDeviceConnection();
  }, []);

  // Persistent State in LocalStorage v7 (Clean Production by default)
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('app_employees_v7');
    if (saved) {
      try { 
        return JSON.parse(saved); 
      } catch (e) { console.error(e); }
    }
    return INITIAL_EMPLOYEES;
  });

  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(() => {
    const saved = localStorage.getItem('app_leave_records_v7');
    if (saved) {
      try { 
        return JSON.parse(saved); 
      } catch (e) { console.error(e); }
    }
    return INITIAL_LEAVE_RECORDS;
  });

  // Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [modalInitialEmployeeId, setModalInitialEmployeeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem('app_employees_v7', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('app_leave_records_v7', JSON.stringify(leaveRecords));
  }, [leaveRecords]);

  const handleResetDemoData = () => {
    if (window.confirm('Recharger le jeu de données démo exemple (Employé X inclus) ?')) {
      setEmployees(SAMPLE_DEMO_EMPLOYEES);
      setLeaveRecords(SAMPLE_DEMO_LEAVE_RECORDS);
      localStorage.setItem('app_employees_v7', JSON.stringify(SAMPLE_DEMO_EMPLOYEES));
      localStorage.setItem('app_leave_records_v7', JSON.stringify(SAMPLE_DEMO_LEAVE_RECORDS));

      addActivityLog({
        action: 'DATA_RESET',
        actionLabel: 'Rechargement Démo',
        details: 'Rechargement du jeu de données démo (Employé X inclus).'
      });
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('ATTENTION: Vider complètement tous les employés et congés ?')) {
      setEmployees([]);
      setLeaveRecords([]);
      localStorage.setItem('app_employees_v7', '[]');
      localStorage.setItem('app_leave_records_v7', '[]');

      addActivityLog({
        action: 'DATA_CLEARED',
        actionLabel: 'Nettoyage Base de Données',
        details: 'Suppression complète de tous les employés et registres de congés.'
      });
    }
  };

  // Handlers for Employee
  const handleAddEmployee = (newEmpData: Omit<Employee, 'id' | 'createdAt'>) => {
    const newEmp: Employee = {
      ...newEmpData,
      id: `emp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setEmployees((prev) => [newEmp, ...prev]);

    addActivityLog({
      action: 'EMPLOYEE_CREATED',
      actionLabel: 'Création Employé',
      details: `Ajout de l'employé ${newEmp.name} (Contrat ${newEmp.contractType}, Embéché le ${newEmp.hireDate})`,
      targetId: newEmp.id,
    });
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((emp) => (emp.id === updatedEmp.id ? updatedEmp : emp)));

    addActivityLog({
      action: 'EMPLOYEE_UPDATED',
      actionLabel: 'Modification Employé',
      details: `Mise à jour de la fiche de ${updatedEmp.name} (Contrat ${updatedEmp.contractType})`,
      targetId: updatedEmp.id,
    });
  };

  const handleDeleteEmployee = (id: string) => {
    const empToDelete = employees.find((e) => e.id === id);
    if (window.confirm(`Confirmer la suppression définitive de ${empToDelete?.name || 'cet employé'} ?`)) {
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));
      setLeaveRecords((prev) => prev.filter((r) => r.employeeId !== id));

      addActivityLog({
        action: 'EMPLOYEE_DELETED',
        actionLabel: 'Suppression Employé',
        details: `Suppression de l'employé ${empToDelete?.name || id} et de son historique de congés.`,
        targetId: id,
      });
    }
  };

  // Handlers for Leave Record
  const handleAddLeaveRecord = (recordData: Omit<LeaveRecord, 'id' | 'createdAt'>) => {
    const newRecord: LeaveRecord = {
      ...recordData,
      id: `rec-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setLeaveRecords((prev) => [newRecord, ...prev]);

    const targetEmp = employees.find((e) => e.id === recordData.employeeId);
    addActivityLog({
      action: 'LEAVE_ADDED',
      actionLabel: 'Saisie de Congé',
      details: `Enregistrement de ${newRecord.daysCount}j pour ${targetEmp?.name || recordData.employeeId} (${newRecord.startDate} -> ${newRecord.endDate})`,
      targetId: newRecord.id,
    });
  };

  const handleDeleteLeaveRecord = (id: string) => {
    const recToDelete = leaveRecords.find((r) => r.id === id);
    setLeaveRecords((prev) => prev.filter((r) => r.id !== id));

    addActivityLog({
      action: 'LEAVE_DELETED',
      actionLabel: 'Annulation Congé',
      details: `Annulation de la saisie de congé ID ${id} (${recToDelete?.daysCount || 0} jours).`,
      targetId: id,
    });
  };

  const handleOpenLeaveModal = (empId?: string) => {
    setModalInitialEmployeeId(empId);
    setIsLeaveModalOpen(true);
  };

  const handleSelectEmployeeDetail = (empId: string) => {
    setActiveTab('employees');
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-800 flex flex-col justify-between font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Header Bar */}
      <header className="border-b border-stone-200/80 bg-white sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="font-bold text-stone-900 text-base tracking-tight">Calculateur & Suivi des Congés</span>
              <span className="hidden sm:inline-block ml-2 text-2xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-mono font-bold">
                RH & Traçabilité Réelle
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-quick-add-absence"
              onClick={() => handleOpenLeaveModal()}
              className="inline-flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Nouveau Congé / Demande</span>
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-2xs font-semibold bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Audit & Traçabilité Actifs
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-t border-stone-100 bg-stone-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            <button
              id="tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'dashboard'
                  ? 'border-stone-900 text-stone-900 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Tableau de Bord & Graphs
            </button>

            <button
              id="tab-employees"
              onClick={() => setActiveTab('employees')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'employees'
                  ? 'border-stone-900 text-stone-900 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Employés ({employees.length})
            </button>

            <button
              id="tab-ledger"
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'ledger'
                  ? 'border-stone-900 text-stone-900 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Journal des Congés ({leaveRecords.length})
            </button>

            <button
              id="tab-audit"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === 'audit'
                  ? 'border-stone-900 text-stone-900 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Audit & Appareils
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        {activeTab === 'dashboard' && (
          <DashboardOverview
            employees={employees}
            leaveRecords={leaveRecords}
            onOpenLeaveModal={handleOpenLeaveModal}
            onSelectEmployee={handleSelectEmployeeDetail}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeManager
            employees={employees}
            leaveRecords={leaveRecords}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onOpenLeaveModal={handleOpenLeaveModal}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerHistory
            employees={employees}
            leaveRecords={leaveRecords}
            onDeleteLeaveRecord={handleDeleteLeaveRecord}
            onOpenLeaveModal={handleOpenLeaveModal}
          />
        )}

        {activeTab === 'audit' && (
          <AuditLogsManager
            onResetDemoData={handleResetDemoData}
            onClearAllData={handleClearAllData}
            employeeCount={employees.length}
            leaveRecordCount={leaveRecords.length}
          />
        )}
      </main>

      {/* Admin Leave Modal */}
      <LeaveLedgerModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        employees={employees}
        leaveRecords={leaveRecords}
        initialEmployeeId={modalInitialEmployeeId}
        onAddLeaveRecord={handleAddLeaveRecord}
      />

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white text-xs text-stone-500 py-4 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Gestion RH, Calculateur & Traçabilité des Appareils Connectés</span>
          </div>
          <span>Google AI Studio</span>
        </div>
      </footer>
    </div>
  );
}

