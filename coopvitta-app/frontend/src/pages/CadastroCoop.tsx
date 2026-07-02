import { Link } from 'react-router-dom';
import { FormWizard } from '../features/cadastro-coop/components/wizard/FormWizard';
import '../features/cadastro-coop/cadastro-coop-theme.css';

const CadastroCoop = () => (
  <div className="cadastro-coop-root">
    <FormWizard embedded />
    <p className="text-center text-sm pb-6" style={{ color: 'var(--text-muted)' }}>
      Já possui cadastro?{' '}
      <Link to="/login" className="font-semibold" style={{ color: 'var(--brand-blue)' }}>
        Entrar na plataforma
      </Link>
    </p>
  </div>
);

export default CadastroCoop;
