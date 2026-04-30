import ChatClientPage from "./page-client";

export default async function ChatPage({ searchParams }) {
  const params = await searchParams;
  return (
    <ChatClientPage
      initialPrompt={typeof params?.prompt === "string" ? params.prompt : ""}
      initialConversationId={typeof params?.c === "string" ? params.c : ""}
    />
  );
}
