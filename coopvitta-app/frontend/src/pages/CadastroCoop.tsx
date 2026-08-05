import { FormWizard } from '../features/cadastro-coop/components/wizard/FormWizard';
import '../features/cadastro-coop/cadastro-coop-theme.css';

const CadastroCoop = () => (
  <div className="cadastro-coop-root">
    <FormWizard embedded />
  </div>
);

export default CadastroCoop;
