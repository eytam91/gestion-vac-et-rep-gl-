import { Employee, LeaveRecord, EmployeeStats, LeaveType } from '../types';

// Taux d'acquisition quotidien de congés en jours
export class DailyAccrualRates {
  static readonly TYPE_A = 30 / 182.5; // ~0.16438356 j/j (30 jours tous les 6 mois)
  static readonly TYPE_B = 30 / 365;   // ~0.08219178 j/j (30 jours par an)
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  CONGE_PAYE: 'Congé Payé Standard',
  RECUPERATION_JOURS: 'Récupération de jours',
  MALADIE_JUSTIFIEE: 'Congé Maladie Justifié',
  PATERNITE: 'Congé Paternité',
  MARIAGE: 'Congé Evénement Familial (Mariage)',
  DECES: 'Congé Evénement Familial (Décès)',
  AUTRE: 'Autre Congé Autorisée',
};

export const LEAVE_TYPE_COLORS: Record<LeaveType, { bg: string; text: string; border: string }> = {
  CONGE_PAYE: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
  RECUPERATION_JOURS: { bg: 'bg-emerald-50', text: 'text-emerald-950', border: 'border-emerald-300' },
  MALADIE_JUSTIFIEE: { bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200' },
  PATERNITE: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200' },
  MARIAGE: { bg: 'bg-purple-50', text: 'text-purple-900', border: 'border-purple-200' },
  DECES: { bg: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-300' },
  AUTRE: { bg: 'bg-teal-50', text: 'text-teal-900', border: 'border-teal-200' },
};

/**
 * Calcule toutes les métriques du solde de congés, solde négatif et régularisation d'un employé.
 * Improvements:
 * - Ignore future leave records (start date after `currentDateStr`).
 * - For ongoing leaves (start <= now <= end) count only the days up to `now`.
 * - Use the leave record dates to compute effective days taken up to `currentDateStr` instead of trusting the provided daysCount
 *   when part of the leave is still in the future. This makes the "current balance" reflect what has actually been consumed.
 */
export function calculateEmployeeStats(
  employee: Employee,
  leaveRecords: LeaveRecord[],
  currentDateStr: string = new Date().toISOString().split('T')[0]
): EmployeeStats {
  const hireDate = new Date(employee.hireDate);
  const now = new Date(currentDateStr);
  
  // Calcul du nombre de jours écoulés depuis l'embauche
  const diffTime = Math.max(0, now.getTime() - hireDate.getTime());
  const daysSinceHire = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const dailyAccrualRate =
    employee.contractType === 'TYPE_A'
      ? DailyAccrualRates.TYPE_A
      : DailyAccrualRates.TYPE_B;

  // Total des jours accumulés théoriques par le travail
  const rawAccrued = daysSinceHire * dailyAccrualRate;
  const totalAccruedDays = Math.max(0, rawAccrued);

  // Filtrer les enregistrements de cet employé
  const empRecords = leaveRecords.filter((r) => r.employeeId === employee.id);

  let congePayeDays = 0;
  let unpaidLeaveDays = 0;
  let recuperationDays = 0;
  let maladieDays = 0;
  let paterniteDays = 0;
  let mariageDays = 0;
  let decesDays = 0;
  let autreDays = 0;

  const msPerDay = 1000 * 60 * 60 * 24;

  function effectiveDaysTaken(record: LeaveRecord): number {
    // Compute how many days from this record have been consumed up to `now`.
    // If the record starts in the future, return 0.
    const start = new Date(record.startDate);
    const end = new Date(record.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return record.daysCount || 0;
    if (start.getTime() > now.getTime()) return 0; // future leave - not yet consumed

    const effectiveEnd = end.getTime() > now.getTime() ? now : end;
    // Inclusive day count: floor(diff / msPerDay) + 1
    const days = Math.floor((effectiveEnd.getTime() - start.getTime()) / msPerDay) + 1;
    if (days < 0) return 0;
    return days;
  }

  empRecords.forEach((r) => {
    // If the request is unpaid (without balance)
    if (r.isPaid === false) {
      // unpaid leave may also be in the future; count only consumed portion
      unpaidLeaveDays += effectiveDaysTaken(r);
      return;
    }

    // Count only days that have already occurred (ignore purely future days)
    const daysConsumed = effectiveDaysTaken(r);
    if (daysConsumed === 0) return;

    switch (r.leaveType) {
      case 'CONGE_PAYE':
        congePayeDays += daysConsumed;
        break;
      case 'RECUPERATION_JOURS':
        recuperationDays += daysConsumed;
        break;
      case 'MALADIE_JUSTIFIEE':
        maladieDays += daysConsumed;
        break;
      case 'PATERNITE':
        paterniteDays += daysConsumed;
        break;
      case 'MARIAGE':
        mariageDays += daysConsumed;
        break;
      case 'DECES':
        decesDays += daysConsumed;
        break;
      case 'AUTRE':
        autreDays += daysConsumed;
        break;
      default:
        break;
    }
  });

  // Solde de congés payés = (acquis par activité + jours de récupération) - (congés payés pris)
  const balanceDays = (totalAccruedDays + recuperationDays) - congePayeDays;

  const isDebt = balanceDays < 0;
  const debtDays = isDebt ? Math.abs(balanceDays) : 0;
  const isExceededAllocatedDays = isDebt;
  const exceededDays = debtDays;

  // Estimation du nombre de jours de travail nécessaires pour résorber/régulariser le solde négatif
  const daysToPayback = isDebt && dailyAccrualRate > 0 ? Math.ceil(debtDays / dailyAccrualRate) : 0;

  return {
    daysSinceHire,
    dailyAccrualRate,
    totalAccruedDays,
    totalLeaveTakenDays: congePayeDays,
    balanceDays,
    isDebt,
    debtDays,
    isExceededAllocatedDays,
    exceededDays,
    daysToPayback,

    congePayeDays,
    unpaidLeaveDays,
    recuperationDays,
    maladieDays,
    paterniteDays,
    mariageDays,
    decesDays,
    autreDays,
  };
}

// Default initial arrays are empty for real production environment
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_LEAVE_RECORDS: LeaveRecord[] = [];

// Sample demo datasets available on demand via Audit & Maintenance
export const SAMPLE_DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'emp-x',
    name: 'Employé X (Alexandre - Type B)',
    hireDate: '2024-06-01',
    contractType: 'TYPE_B', // 30 jours par an (Embauché le 01/06/2024)
    createdAt: new Date('2024-06-01').toISOString(),
  },
  {
    id: 'emp-101',
    name: 'Karim Alami',
    hireDate: '2024-01-15',
    contractType: 'TYPE_A', // 30 jours tous les 6 mois (182.5 jours de travail)
    createdAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: 'emp-102',
    name: 'Sophie Laurent',
    hireDate: '2024-06-01',
    contractType: 'TYPE_A',
    createdAt: new Date('2024-06-01').toISOString(),
  },
  {
    id: 'emp-103',
    name: 'Jean-Pierre Dubois',
    hireDate: '2025-02-10',
    contractType: 'TYPE_B', // 30 jours par an (365 jours de travail)
    createdAt: new Date('2025-02-10').toISOString(),
  },
];

export const SAMPLE_DEMO_LEAVE_RECORDS: LeaveRecord[] = [
  {
    id: 'rec-x1',
    employeeId: 'emp-x',
    startDate: '2024-08-05',
    endDate: '2024-08-20',
    daysCount: 15,
    leaveType: 'CONGE_PAYE',
    isPaid: true,
    notes: 'Premier congé payé d\'été 2024 (15j pris)',
    createdAt: new Date('2024-08-01').toISOString(),
  },
  {
    id: 'rec-x2',
    employeeId: 'emp-x',
    startDate: '2024-11-10',
    endDate: '2024-11-10',
    daysCount: 5,
    leaveType: 'RECUPERATION_JOURS',
    isPaid: true,
    notes: 'Crédit de 5 jours de récupération (heures supp.)',
    createdAt: new Date('2024-11-10').toISOString(),
  },
  {
    id: 'rec-x3',
    employeeId: 'emp-x',
    startDate: '2025-02-17',
    endDate: '2025-02-19',
    daysCount: 3,
    leaveType: 'MALADIE_JUSTIFIEE',
    isPaid: true,
    notes: 'Arrêt maladie justifié de 3 jours',
    createdAt: new Date('2025-02-17').toISOString(),
  },
  {
    id: 'rec-x4',
    employeeId: 'emp-x',
    startDate: '2025-07-01',
    endDate: '2025-07-10',
    daysCount: 10,
    leaveType: 'AUTRE',
    isPaid: false,
    notes: 'Congé sans solde (non payé)',
    createdAt: new Date('2025-06-25').toISOString(),
  },
  {
    id: 'rec-x5',
    employeeId: 'emp-x',
    startDate: '2026-06-01',
    endDate: '2026-07-25',
    daysCount: 55,
    leaveType: 'CONGE_PAYE',
    isPaid: true,
    notes: 'Grand congé annuel 2026 (55j pris)',
    createdAt: new Date('2026-05-20').toISOString(),
  },
];
