import BeckForm from './forms/BeckForm'
import BtaForm from './forms/BtaForm'
import D2Form from './forms/D2Form'
import StaiForm from './forms/StaiForm'
import TmtForm from './forms/TmtForm'
import TavecForm from './forms/TavecForm'
import FluidezFasForm from './forms/FluidezFasForm'
import FluidezPrmForm from './forms/FluidezPrmForm'
import FluidezSemanticaForm from './forms/FluidezSemanticaForm'
import GenericForm from './forms/GenericForm'
import ReyForm from './forms/ReyForm'
import DigitosForm from './forms/DigitosForm'
import WaisSubtestForm from './forms/WaisSubtestForm'
import TorreForm from './forms/TorreForm'
import StroopForm from './forms/StroopForm'
import MocaForm from './forms/MocaForm'

interface Props {
  testType: string
  mode: 'live' | 'paper'
  onSave: (raw: Record<string, unknown>, qual?: Record<string, unknown>) => Promise<void>
  onSkip?: () => void
  saving: boolean
  initialData?: Record<string, unknown>
  initialQual?: Record<string, unknown>
  saveLabel?: string
}

export default function TestFormDispatcher({ testType, mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }: Props) {
  const commonProps = { mode, onSave, onSkip, saving, initialData, initialQual, saveLabel }

  if (testType === 'TMT-A' || testType === 'TMT-B')
    return <TmtForm testType={testType as 'TMT-A' | 'TMT-B'} {...commonProps} />
  if (testType === 'TAVEC') return <TavecForm {...commonProps} />
  if (testType === 'Fluidez-FAS' || testType === 'FAS-Verbal')
    return <FluidezFasForm {...commonProps} />
  if (testType === 'Fluidez-PRM')
    return <FluidezPrmForm {...commonProps} />
  if (testType === 'Fluidez-Semantica')
    return <FluidezSemanticaForm {...commonProps} />
  if (testType === 'Rey-Copia' || testType === 'Rey-Memoria')
    return <ReyForm testType={testType as 'Rey-Copia' | 'Rey-Memoria'} {...commonProps} />
  if (
    testType === 'Dígitos-WAIS' ||
    testType === 'Dígitos-Directos' ||
    testType === 'Dígitos-Inversos' ||
    testType === 'Letras-Números'
  )
    return <DigitosForm {...commonProps} />
  if (
    testType === 'Aritmética' ||
    testType === 'Semejanzas' ||
    testType === 'Vocabulario' ||
    testType === 'Matrices' ||
    testType === 'Cubos' ||
    testType === 'Clave-Números' ||
    testType === 'Búsqueda-Símbolos'
  )
    return (
      <WaisSubtestForm
        testType={
          testType as
            | 'Aritmética'
            | 'Semejanzas'
            | 'Vocabulario'
            | 'Matrices'
            | 'Cubos'
            | 'Clave-Números'
            | 'Búsqueda-Símbolos'
        }
        {...commonProps}
      />
    )
  if (testType === 'BTA') return <BtaForm {...commonProps} />
  if (testType === 'BDI-II' || testType === 'Beck') return <BeckForm {...commonProps} />
  if (testType === 'STAI') return <StaiForm {...commonProps} />
  if (testType === 'Test-d2-R') return <D2Form {...commonProps} />
  if (testType === 'Torre-Londres') return <TorreForm {...commonProps} />
  if (testType === 'Stroop') return <StroopForm {...commonProps} />
  if (testType === 'MoCA') return <MocaForm {...commonProps} />
  return <GenericForm testType={testType} {...commonProps} />
}
