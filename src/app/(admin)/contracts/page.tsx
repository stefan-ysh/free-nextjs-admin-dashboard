import type { Metadata } from 'next';

import ContractsClient from '@/components/contracts/ContractsClient';

export const metadata: Metadata = {
	title: '合同管理',
};

export default function ContractsPage() {
	return <ContractsClient />;
}
