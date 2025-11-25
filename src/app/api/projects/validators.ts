import { randomUUID } from 'crypto';

import type {
	ContractRiskLevel,
	ContractType,
	CreateProjectInput,
	CurrencyCode,
	MilestoneStatus,
	ProjectMilestone,
	ProjectPriority,
	ProjectStatus,
	UpdateProjectInput,
} from '@/types/project';

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled'];
const PROJECT_PRIORITIES: ProjectPriority[] = ['low', 'medium', 'high', 'urgent'];
const CONTRACT_TYPES: ContractType[] = ['service', 'purchase', 'maintenance', 'consulting', 'other'];
const CURRENCY_CODES: CurrencyCode[] = ['CNY', 'USD', 'HKD', 'EUR', 'JPY', 'GBP', 'OTHER'];
const RISK_LEVELS: ContractRiskLevel[] = ['low', 'medium', 'high'];
const MILESTONE_STATUSES: MilestoneStatus[] = ['pending', 'in_progress', 'completed', 'delayed'];

const MAX_ATTACHMENTS = 20;
const MAX_MILESTONES = 50;
const MAX_TEAM_MEMBERS = 100;

export class ProjectValidationError extends Error {}

type EnumValue<T> = T extends readonly (infer U)[] ? U : never;

function ensureObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object') {
		throw new ProjectValidationError('请求体必须是对象');
	}
	return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new ProjectValidationError(`${field} 必须为非空字符串`);
	}
	return value.trim();
}

function optionalString(value: unknown): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') {
		throw new ProjectValidationError('字段必须为字符串');
	}
	const trimmed = value.trim();
	return trimmed || undefined;
}

function nullableString(value: unknown, field: string): string | null {
	if (value === null) return null;
	if (typeof value !== 'string') {
		throw new ProjectValidationError(`${field} 必须为字符串或 null`);
	}
	const trimmed = value.trim();
	return trimmed || null;
}

function optionalNullableString(value: unknown, field: string): string | null | undefined {
	if (value === undefined) return undefined;
	return nullableString(value, field);
}

function optionalNumber(value: unknown, field: string): number | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'number' && !Number.isNaN(value)) return value;
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}
	throw new ProjectValidationError(`${field} 必须为数字`);
}

function optionalNullableNumber(value: unknown, field: string): number | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	return optionalNumber(value, field);
}

function optionalEnum<T extends readonly string[]>(
	value: unknown,
	options: T,
	field: string
): EnumValue<T> | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value !== 'string') {
		throw new ProjectValidationError(`${field} 必须为字符串`);
	}
	const normalized = value.trim();
	if (!options.includes(normalized as EnumValue<T>)) {
		throw new ProjectValidationError(`${field} 值无效`);
	}
	return normalized as EnumValue<T>;
}

function optionalEnumOrNull<T extends readonly string[]>(
	value: unknown,
	options: T,
	field: string
): EnumValue<T> | null | undefined {
	if (value === undefined) return undefined;
	if (value === null) return null;
	return optionalEnum(value, options, field);
}

function parseStringArray(
	value: unknown,
	field: string,
	{ max = MAX_ATTACHMENTS, allowEmpty = true }: { max?: number; allowEmpty?: boolean } = {}
): string[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (!Array.isArray(value)) {
		throw new ProjectValidationError(`${field} 必须为字符串数组`);
	}
	if (value.length > max) {
		throw new ProjectValidationError(`${field} 最多 ${max} 项`);
	}
	const normalized = value
		.map((item) => {
			if (typeof item !== 'string') {
				throw new ProjectValidationError(`${field} 中存在非字符串项`);
			}
			const trimmed = item.trim();
			return trimmed || null;
		})
		.filter(Boolean) as string[];
	if (!allowEmpty && normalized.length === 0) {
		return undefined;
	}
	return normalized;
}

function parseTeamMembers(value: unknown): string[] | undefined {
	const result = parseStringArray(value, 'teamMemberIds', { max: MAX_TEAM_MEMBERS });
	return result;
}

function parseMilestones(value: unknown): ProjectMilestone[] | undefined {
	if (value === undefined || value === null) return undefined;
	if (!Array.isArray(value)) {
		throw new ProjectValidationError('milestones 必须为数组');
	}
	if (value.length > MAX_MILESTONES) {
		throw new ProjectValidationError(`milestones 最多 ${MAX_MILESTONES} 项`);
	}
	return value.map((item, index) => {
		if (!item || typeof item !== 'object') {
			throw new ProjectValidationError(`milestones[${index}] 必须为对象`);
		}
		const record = item as Record<string, unknown>;
		const title = requireString(record.title, `milestones[${index}].title`);
		const description = optionalString(record.description) ?? null;
		const dueDate = optionalString(record.dueDate) ?? null;
		const amount = optionalNullableNumber(record.amount, `milestones[${index}].amount`);
		const status = optionalEnum(record.status, MILESTONE_STATUSES, `milestones[${index}].status`) ?? 'pending';
		const idValue = optionalString(record.id);
		return {
			id: idValue ?? randomUUID(),
			title,
			description,
			dueDate,
			amount: amount ?? null,
			status,
		};
	});
}

function clampTaxRate(value: number | undefined): number | undefined {
	if (value === undefined) return undefined;
	if (value < 0) return 0;
	if (value > 100) return 100;
	return Number(value.toFixed(2));
}

export function parseCreateProjectPayload(data: unknown): CreateProjectInput {
	const body = ensureObject(data);
	const projectName = requireString(body.projectName, 'projectName');
	const projectManagerId = requireString(body.projectManagerId, 'projectManagerId');

	const payload: CreateProjectInput = {
		projectCode: typeof body.projectCode === 'string' ? body.projectCode.trim() : '',
		projectName,
		projectManagerId,
	};

	const description = optionalString(body.description);
	if (description !== undefined) payload.description = description;

	const clientName = optionalString(body.clientName);
	if (clientName !== undefined) payload.clientName = clientName;

	const contractAmount = optionalNumber(body.contractAmount, 'contractAmount');
	if (contractAmount !== undefined) payload.contractAmount = contractAmount;

	const budget = optionalNumber(body.budget, 'budget');
	if (budget !== undefined) payload.budget = budget;

	const startDate = optionalString(body.startDate);
	if (startDate !== undefined) payload.startDate = startDate;
	const endDate = optionalString(body.endDate);
	if (endDate !== undefined) payload.endDate = endDate;
	const expectedEndDate = optionalString(body.expectedEndDate);
	if (expectedEndDate !== undefined) payload.expectedEndDate = expectedEndDate;

	const status = optionalEnum(body.status, PROJECT_STATUSES, 'status');
	if (status) payload.status = status;
	const priority = optionalEnum(body.priority, PROJECT_PRIORITIES, 'priority');
	if (priority) payload.priority = priority;

	const teamMemberIds = parseTeamMembers(body.teamMemberIds);
	if (teamMemberIds) payload.teamMemberIds = teamMemberIds;

	const contractNumber = optionalString(body.contractNumber);
	if (contractNumber !== undefined) payload.contractNumber = contractNumber;

	const contractType = optionalEnum(body.contractType, CONTRACT_TYPES, 'contractType');
	if (contractType) payload.contractType = contractType;

	const signingDate = optionalString(body.signingDate);
	if (signingDate !== undefined) payload.signingDate = signingDate;
	const effectiveDate = optionalString(body.effectiveDate);
	if (effectiveDate !== undefined) payload.effectiveDate = effectiveDate;
	const expirationDate = optionalString(body.expirationDate);
	if (expirationDate !== undefined) payload.expirationDate = expirationDate;

	const partyA = optionalString(body.partyA);
	if (partyA !== undefined) payload.partyA = partyA;
	const partyB = optionalString(body.partyB);
	if (partyB !== undefined) payload.partyB = partyB;

	const currency = optionalEnum(body.currency, CURRENCY_CODES, 'currency');
	if (currency) payload.currency = currency;

	const taxRate = clampTaxRate(optionalNumber(body.taxRate, 'taxRate'));
	if (taxRate !== undefined) payload.taxRate = taxRate;

	const paymentTerms = optionalString(body.paymentTerms);
	if (paymentTerms !== undefined) payload.paymentTerms = paymentTerms;

	const riskLevel = optionalEnum(body.riskLevel, RISK_LEVELS, 'riskLevel');
	if (riskLevel) payload.riskLevel = riskLevel;

	const attachments = parseStringArray(body.attachments, 'attachments');
	if (attachments !== undefined) payload.attachments = attachments;

	const milestones = parseMilestones(body.milestones);
	if (milestones !== undefined) payload.milestones = milestones;

	return payload;
}

export function parseUpdateProjectPayload(data: unknown): UpdateProjectInput {
	const body = ensureObject(data);
	const payload: UpdateProjectInput = {};

	if ('projectName' in body) payload.projectName = requireString(body.projectName, 'projectName');
	if ('description' in body) payload.description = nullableString(body.description, 'description');
	if ('clientName' in body) payload.clientName = nullableString(body.clientName, 'clientName');
	if ('contractAmount' in body) payload.contractAmount = optionalNullableNumber(body.contractAmount, 'contractAmount') ?? null;
	if ('budget' in body) payload.budget = optionalNullableNumber(body.budget, 'budget') ?? null;
	if ('startDate' in body) payload.startDate = optionalNullableString(body.startDate, 'startDate');
	if ('endDate' in body) payload.endDate = optionalNullableString(body.endDate, 'endDate');
	if ('expectedEndDate' in body) payload.expectedEndDate = optionalNullableString(body.expectedEndDate, 'expectedEndDate');
	if ('status' in body) payload.status = optionalEnum(body.status, PROJECT_STATUSES, 'status');
	if ('priority' in body) payload.priority = optionalEnum(body.priority, PROJECT_PRIORITIES, 'priority');
	if ('projectManagerId' in body) payload.projectManagerId = requireString(body.projectManagerId, 'projectManagerId');
	if ('teamMemberIds' in body) payload.teamMemberIds = parseTeamMembers(body.teamMemberIds) ?? [];

	if ('contractNumber' in body) payload.contractNumber = nullableString(body.contractNumber, 'contractNumber');
	if ('contractType' in body)
		payload.contractType = optionalEnumOrNull(body.contractType, CONTRACT_TYPES, 'contractType') ?? null;
	if ('signingDate' in body) payload.signingDate = optionalNullableString(body.signingDate, 'signingDate');
	if ('effectiveDate' in body) payload.effectiveDate = optionalNullableString(body.effectiveDate, 'effectiveDate');
	if ('expirationDate' in body) payload.expirationDate = optionalNullableString(body.expirationDate, 'expirationDate');
	if ('partyA' in body) payload.partyA = nullableString(body.partyA, 'partyA');
	if ('partyB' in body) payload.partyB = nullableString(body.partyB, 'partyB');
	if ('currency' in body) payload.currency = optionalEnum(body.currency, CURRENCY_CODES, 'currency');
	if ('taxRate' in body) payload.taxRate = clampTaxRate(optionalNullableNumber(body.taxRate, 'taxRate') ?? undefined);
	if ('paymentTerms' in body) payload.paymentTerms = nullableString(body.paymentTerms, 'paymentTerms');
	if ('riskLevel' in body) payload.riskLevel = optionalEnum(body.riskLevel, RISK_LEVELS, 'riskLevel');
	if ('attachments' in body) payload.attachments = parseStringArray(body.attachments, 'attachments') ?? [];
	if ('milestones' in body) payload.milestones = parseMilestones(body.milestones) ?? [];

	return payload;
}
