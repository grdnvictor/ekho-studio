export default function (router: Router) {
    router.post(
      "/audio-agent/chat",
      authenticateUser,
      validateContract(AudioAgentChatContract),
      AudioAgentController.chat
    );
    
    router.post(
      "/audio-agent/generate-project",
      authenticateUser,
      validateContract(AudioProjectContract),
      AudioAgentController.generateProject
    );
    
    return router;
  }