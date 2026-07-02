interface FeaturePlaceholderProps {
  title: string;
  description: string;
}

const FeaturePlaceholder = ({ title, description }: FeaturePlaceholderProps) => {
  return (
    <div className="card border-l-4 border-coop-500">
      <h2 className="text-2xl font-bold text-coop-900 mb-2">{title}</h2>
      <p className="text-gray-600">{description}</p>
    </div>
  );
};

export default FeaturePlaceholder;
