import { FaEnvelope } from "react-icons/fa6";

const SocialIcons = () => {
  return (
    <div className="my-5 flex items-center justify-center">
      <a
        href="mailto:ai@widechaos.cn"
        className="text-zinc-400 hover:text-[#69c7c7] drop-shadow-[1px_1px_0_#7836cf]"
        aria-label="Email"
      >
        <FaEnvelope className="h-7 w-7" />
      </a>
    </div>
  );
};

export default SocialIcons;
