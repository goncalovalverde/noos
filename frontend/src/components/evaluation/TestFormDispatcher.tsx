import TmtForm from './forms/TmtForm'
import TavecForm from './forms/TavecForm'
import FluidezFasForm from './forms/FluidezFasForm'
import GenericForm from './forms/GenericForm'

interface Props {
  testType: string
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip: () => void
  saving: boolean
}

export default function TestFormDispatcher({ testType, mode, onSave, onSkip, saving }: Props) {
  const commonProps = { mode, onSave, onSkip, saving }

  if (testType === 'TMT-A' || testType === 'TMT-B')
    return <TmtForm testType={testType as 'TMT-A' | 'TMT-B'} {...commonProps} />
  if (testType === 'TAVEC') return <TavecForm {...commonProps} />
  if (testType === 'Fluidez-FAS') return <FluidezFasForm {...commonProps} />
  return <GenericForm testType={testType} {...commonProps} />
}
