import os
import torch

class Settings:
    MODEL_ID: str = os.getenv("LAYA_MODEL_ID", "convaiinnovations/laya")
    API_KEY: str = os.getenv("LAYA_API_KEY", "")
    HOST: str = os.getenv("LAYA_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("LAYA_PORT", "8000"))
    
    @property
    def DEVICE(self) -> str:
        dev = os.getenv("LAYA_DEVICE", "auto").lower()
        if dev == "auto":
            if torch.backends.mps.is_available():
                return "mps"
            elif torch.cuda.is_available():
                return "cuda"
            return "cpu"
        return dev

settings = Settings()
