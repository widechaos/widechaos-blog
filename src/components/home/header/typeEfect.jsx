import React from "react";
import Typewriter from "typewriter-effect";

const TypewriterComponent = ({ strings }) => {
  const effectiveStrings =
    Array.isArray(strings) && strings.length > 0
      ? strings
      : ["量化工程", "AI工程化", "DevOps/云架构", "UX/UI"];

  return (
    <div className="notranslate mt-5 text-3xl font-bold">
      <Typewriter
        options={{
          strings: effectiveStrings,
          autoStart: true,
          loop: true,
        }}
      />
    </div>
  );
};

export default TypewriterComponent;
