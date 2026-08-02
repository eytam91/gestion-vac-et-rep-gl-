import React, { useState } from 'react';
import { 
  UserPlus, 
  Users, 
  Search, 
  Trash2, 
  Edit3, 
  Calendar, 
  Check, 
  X, 
  Briefcase, 
  BadgeCheck, 
  Clock, 
  Plus, 
  AlertTriangle,
  FileText,
  Banknote,
  History
} from 'lucide-react';
import { Employee, ContractType, LeaveRecord } from '../types';
import { calculateEmployeeStats, LEAVE_TYPE_LABELS } from '../utils/vacationCalc';

interface EmployeeManagerProps {
  employees: Employee[];
  leaveRecords: LeaveRecord[];
  onAddEmployee: (employee: Omit<Employee, 'id' | 'createdAt'>) => void;
  onUpdateEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onOpenLeaveModal: (employeeId: string) => void;
}

export const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  leaveRecords,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onOpenLeaveModal,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contractFilter, setContractFilter] = useState<'ALL' | ContractType>('ALL');
  const [selectedEmployeeDetailId, setSelectedEmployeeDetailId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [contractType, setContractType] = useState<ContractType>('TYPE_A');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleOpenAddForm = () => {
    setEditingEmployee(null);
    setName('');
    setHireDate(new Date().toISOString().split('T')[0]);
    setContractType('TYPE_A');
    setErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setHireDate(emp.hireDate);
    setContractType(emp.contractType);
    setErrors({});
    setIsFormOpen(true);
  };

  const validateForm = (): boolean => {
    const errs: { [key: string]: string } = {};
    if (!name.trim()) errs.name = 'Le nom de l\'employé est obligatoire.';
    if (!hireDate) errs.hireDate = 'La date d\'embauche est obligatoire.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (editingEmployee) {
      onUpdateEmployee({
        ...editingEmployee,
        name: name.trim(),
        hireDate,
        contractType,
      });
    } else {
      onAddEmployee({
        name: name.trim(),
        hireDate,
        contractType,
      });
    }

    setIsFormOpen(false);
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContract = contractFilter === 'ALL' || emp.contractType === contractFilter;
    return matchesSearch && matchesContract;
  });

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeDetailId);
  const selectedEmpStats = selectedEmployee ? calculateEmployeeStats(selectedEmployee, leaveRecords) : null;
  const selectedEmpRecords = selectedEmployee ? leaveRecords.filter((r) => r.employeeId === selectedEmployee.id) : [];

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-stone-900">Gestion des Employés & Profils de Congés</h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Configurez le type de contrat (TYPE_A 30j/6 mois vs TYPE_B 30j/12 mois) et la date d'embauche.
          </p>
        </div>

        <button
          id="btn-add-employee-modal"
          onClick={handleOpenAddForm}
          className="inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer active:scale-98"
        >
          <UserPlus className="w-4 h-4" />
          Ajouter un Employé
        </button>
      </div>

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-bold text-stone-900">
                {editingEmployee ? `Modifier l'Employé: ${editingEmployee.name}` : 'Créer un Nouvel Employé'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nom Complet */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Nom & Prénom de l'employé
                </label>
                <input
                  type="text"
                  placeholder="ex: Karim Alami"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-stone-50 text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all ${
                    errors.name ? 'border-red-400' : 'border-stone-200'
                  }`}
                />
                {errors.name && <p className="text-xs text-red-500 font-medium mt-1">{errors.name}</p>}
              </div>

              {/* Date d'Embauche */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Date d'embauche
                </label>
                <input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                />
                <p className="text-2xs text-stone-400 mt-1">
                  Utilisée pour calculer automatiquement les jours de congés acquis à ce jour.
                </p>
              </div>

              {/* Type de Contrat */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Type de Contrat & Droits aux Congés
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                      contractType === 'TYPE_A'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-1 ring-emerald-500/30'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <input
                        type="radio"
                        name="contractType"
                        value="TYPE_A"
                        checked={contractType === 'TYPE_A'}
                        onChange={() => setContractType('TYPE_A')}
                        className="sr-only"
                      />
                      <BadgeCheck className="w-4 h-4 text-emerald-600" />
                      TYPE_A (6 mois)
                    </div>
                    <span className="text-2xs font-normal text-stone-500">
                      • Cycle Semestriel (30j / 6 mois)<br />
                      • ~0.1644 j/j travaillé<br />
                      • Congés après 6 mois
                    </span>
                  </label>

                  <label
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                      contractType === 'TYPE_B'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-500/30'
                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      <input
                        type="radio"
                        name="contractType"
                        value="TYPE_B"
                        checked={contractType === 'TYPE_B'}
                        onChange={() => setContractType('TYPE_B')}
                        className="sr-only"
                      />
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      TYPE_B (Annuel)
                    </div>
                    <span className="text-2xs font-normal text-stone-500">
                      • Cycle Annuel (30j / 12 mois)<br />
                      • ~0.0822 j/j travaillé<br />
                      • Congés après 12 mois
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingEmployee ? 'Enregistrer les modifications' : 'Créer l\'employé'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-stone-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 text-sm bg-stone-50 text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider shrink-0">Contrat:</span>
          <button
            onClick={() => setContractFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              contractFilter === 'ALL'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Tous ({employees.length})
          </button>
          <button
            onClick={() => setContractFilter('TYPE_A')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              contractFilter === 'TYPE_A'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            TYPE_A (6-Mois)
          </button>
          <button
            onClick={() => setContractFilter('TYPE_B')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              contractFilter === 'TYPE_B'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            TYPE_B (Annuel)
          </button>
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEmployees.map((emp) => {
          const stats = calculateEmployeeStats(emp, leaveRecords);

          return (
            <div
              key={emp.id}
              className="bg-white rounded-2xl border border-stone-200/80 shadow-xs hover:border-stone-300 transition-all p-5 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-stone-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      {stats.isDebt && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 border-2 border-white ring-2 ring-red-400/50" title="Solde négatif à régulariser" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-stone-900 text-base">{emp.name}</h3>
                        {stats.isDebt && (
                          <span className="px-2 py-0.5 rounded-full text-3xs font-extrabold bg-red-100 text-red-700 border border-red-300">
                            🔴 Doit régulariser {stats.debtDays.toFixed(1)} j
                          </span>
                        )}
                      </div>
                      <p className="text-2xs text-stone-400">Embauché le {new Date(emp.hireDate).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>

                  {emp.contractType === 'TYPE_A' ? (
                    <span className="px-2 py-0.5 rounded-md text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      TYPE_A
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-2xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      TYPE_B
                    </span>
                  )}
                </div>

                {/* Solde Card Status */}
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500 font-medium">Solde de Congés:</span>
                    {stats.isDebt ? (
                      <span className="font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-md border border-red-300 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                        -{stats.debtDays.toFixed(1)} j (Négatif)
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        +{stats.balanceDays.toFixed(1)} j
                      </span>
                    )}
                  </div>

                  {stats.isDebt ? (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-2xs space-y-1">
                      <p className="font-extrabold text-red-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>Doit régulariser <strong>{stats.debtDays.toFixed(1)} jour(s)</strong></span>
                      </p>
                      <p className="text-stone-600 pl-5">
                        Délai estimé: ~{stats.daysToPayback} jours de travail
                      </p>
                    </div>
                  ) : (
                    <div className="text-2xs text-emerald-700 font-medium flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Solde dans les jours acquis
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={() => onOpenLeaveModal(emp.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Saisir Absence
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedEmployeeDetailId(emp.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold rounded-lg text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
                    title="Consulter l'historique des congés pris par cet employé"
                  >
                    <History className="w-3.5 h-3.5" />
                    Historique
                  </button>
                  <button
                    onClick={() => handleOpenEditForm(emp)}
                    className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg cursor-pointer"
                    title="Modifier employé"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteEmployee(emp.id)}
                    className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Supprimer employé"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && selectedEmpStats && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-stone-900 text-white font-bold text-base flex items-center justify-center">
                  {selectedEmployee.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-600" />
                    Historique des Congés — {selectedEmployee.name}
                  </h3>
                  <p className="text-xs text-stone-500">
                    Contrat {selectedEmployee.contractType} • Embauché le {new Date(selectedEmployee.hireDate).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployeeDetailId(null)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Solde & Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <p className="text-2xs font-bold text-stone-400 uppercase">Jours Acquis Total</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">+{selectedEmpStats.totalAccruedDays.toFixed(1)} j</p>
              </div>

              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <p className="text-2xs font-bold text-stone-400 uppercase">Congés Payés Pris</p>
                <p className="text-lg font-bold text-stone-900 mt-1">{selectedEmpStats.totalLeaveTakenDays} j</p>
              </div>

              <div className={`p-3.5 rounded-xl border ${selectedEmpStats.isDebt ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className="text-2xs font-bold uppercase text-stone-500">Solde Actuel (Solde)</p>
                <p className={`text-lg font-bold mt-1 ${selectedEmpStats.isDebt ? 'text-red-700' : 'text-emerald-700'}`}>
                  {selectedEmpStats.isDebt ? `-${selectedEmpStats.debtDays.toFixed(1)} j` : `+${selectedEmpStats.balanceDays.toFixed(1)} j`}
                </p>
              </div>
            </div>

            {/* Indication if employee passed allocated days */}
            {selectedEmpStats.isDebt && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Dépassement des Jours Acquis (+{selectedEmpStats.exceededDays.toFixed(1)} jours en avance)</span>
                </div>
                <p className="text-red-800 text-2xs leading-relaxed">
                  L'employé a consommé {selectedEmpStats.totalLeaveTakenDays} jours de congé payé pour {selectedEmpStats.totalAccruedDays.toFixed(1)} jours accumulés par son travail. Il lui faudra environ <strong>~{selectedEmpStats.daysToPayback} jours de travail</strong> pour régulariser ce solde négatif.
                </p>
              </div>
            )}

            {/* Detail History List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-stone-600" />
                  <span>Historique des Congés & Absences</span>
                  <span className="text-2xs text-stone-400 font-normal">({selectedEmpRecords.length} enregistrement(s))</span>
                </h4>
                <button
                  onClick={() => {
                    const empId = selectedEmployee.id;
                    setSelectedEmployeeDetailId(null);
                    onOpenLeaveModal(empId);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-stone-950 px-3 py-1.5 rounded-lg transition-all shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Saisir Congé Passé / Nouveau
                </button>
              </div>

              {selectedEmpRecords.length === 0 ? (
                <p className="text-xs text-stone-400 italic py-4 text-center">Aucune absence enregistrée pour cet employé.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedEmpRecords.map((rec) => (
                    <div key={rec.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-stone-900">{LEAVE_TYPE_LABELS[rec.leaveType]}</span>
                          {rec.isPaid === false ? (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              Sans solde
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-3xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              Payé
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-stone-500 mt-0.5">
                          Du {new Date(rec.startDate).toLocaleDateString('fr-FR')} au {new Date(rec.endDate).toLocaleDateString('fr-FR')} {rec.notes ? `• ${rec.notes}` : ''}
                        </p>
                      </div>
                      <span className="font-bold font-mono text-stone-900 shrink-0">
                        {rec.daysCount} jours
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                onClick={() => setSelectedEmployeeDetailId(null)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
